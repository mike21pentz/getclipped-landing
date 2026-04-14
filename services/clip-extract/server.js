const express = require("express");
const { execFile } = require("child_process");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_SECRET = process.env.API_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: API_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Auth middleware
function authenticate(req, res, next) {
  const secret = req.headers["x-api-secret"];
  if (secret !== API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Run a shell command as a promise
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = execFile(cmd, args, { timeout: 300000, ...opts }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd} failed: ${stderr || err.message}`));
      } else {
        resolve(stdout);
      }
    });
    // Log progress
    if (proc.stderr) {
      proc.stderr.on("data", (d) => process.stderr.write(d));
    }
  });
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Extract a clip segment from a YouTube video
app.post("/extract", authenticate, async (req, res) => {
  const { videoId, startSeconds, endSeconds, userId } = req.body;

  if (!videoId || startSeconds == null || endSeconds == null) {
    return res.status(400).json({ error: "videoId, startSeconds, and endSeconds are required" });
  }

  if (endSeconds <= startSeconds) {
    return res.status(400).json({ error: "endSeconds must be greater than startSeconds" });
  }

  const duration = endSeconds - startSeconds;
  if (duration > 300) {
    return res.status(400).json({ error: "Maximum clip duration is 5 minutes" });
  }

  const id = uuidv4();
  const tmpDir = "/tmp";
  const fullVideoPath = path.join(tmpDir, `${id}-full.mp4`);
  const trimmedPath = path.join(tmpDir, `${id}-trimmed.mp4`);

  try {
    console.log(`[extract] Starting: videoId=${videoId} ${startSeconds}s-${endSeconds}s (${duration}s)`);

    // Step 1: Download the video
    // Download only the relevant portion using yt-dlp's section feature
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    await run("yt-dlp", [
      "-f", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
      "--merge-output-format", "mp4",
      "--download-sections", `*${startSeconds}-${endSeconds}`,
      "--force-keyframes-at-cuts",
      "-o", fullVideoPath,
      "--no-playlist",
      "--no-warnings",
      ytUrl,
    ]);

    console.log(`[extract] Download complete`);

    // Step 2: Re-encode trimmed segment for clean cut points
    // yt-dlp's --download-sections may not cut precisely, so we re-trim with ffmpeg
    await run("ffmpeg", [
      "-y",
      "-i", fullVideoPath,
      "-ss", "0",
      "-t", String(duration),
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      trimmedPath,
    ]);

    console.log(`[extract] Trim complete`);

    // Step 3: Upload to Supabase Storage
    const fileBuffer = fs.readFileSync(trimmedPath);
    const fileSize = fileBuffer.length;
    const storagePath = `extracts/${userId || "anonymous"}/${Date.now()}-${videoId}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("clips")
      .upload(storagePath, fileBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    console.log(`[extract] Uploaded to ${storagePath}`);

    // Step 4: Generate signed URL (1 hour)
    const { data: signedData, error: signError } = await supabase.storage
      .from("clips")
      .createSignedUrl(storagePath, 3600);

    if (signError) {
      throw new Error(`Signed URL failed: ${signError.message}`);
    }

    console.log(`[extract] Done. Size: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

    res.json({
      url: signedData.signedUrl,
      storagePath,
      duration: Math.round(duration),
      fileSize,
    });
  } catch (err) {
    console.error(`[extract] Error:`, err.message);
    res.status(500).json({ error: err.message || "Extraction failed" });
  } finally {
    // Cleanup temp files
    try { fs.unlinkSync(fullVideoPath); } catch {}
    try { fs.unlinkSync(trimmedPath); } catch {}
  }
});

app.listen(PORT, () => {
  console.log(`clip-extract service running on port ${PORT}`);
});
