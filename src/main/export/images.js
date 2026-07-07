// MrxDown Main — Bild-Einbettung für Exporte (base64, Downscaling, Traversal-Guard)
const path = require('path');
const fs = require('fs').promises;
const { getCurrentFilePath } = require('./context');

// Phase 2 (PDF-Audit 2026-07-04): Skia bettet Nicht-JPEGs in voller Aufloesung
// als Deflate-Pixel ein — ein 4000-px-Screenshot landet unverkleinert im PDF.
// Downscale auf max. 1600 px Breite (~2x A4-Satzspiegel); JPEGs bleiben JPEG
// (q82, DCT-Passthrough haelt sie klein), Rest wird PNG. SVG/GIF unangetastet.
const PDF_IMAGE_MAX_WIDTH = 1600;
function downscaleImageForPdf(buffer, mimeType) {
    try {
        if (mimeType === 'image/svg+xml' || mimeType === 'image/gif') {
            return { buffer, mimeType };
        }
        const { nativeImage } = require('electron');
        const img = nativeImage.createFromBuffer(buffer);
        if (img.isEmpty()) return { buffer, mimeType };
        const { width } = img.getSize();
        if (width <= PDF_IMAGE_MAX_WIDTH) return { buffer, mimeType };
        const resized = img.resize({ width: PDF_IMAGE_MAX_WIDTH, quality: 'best' });
        if (mimeType === 'image/jpeg') {
            return { buffer: resized.toJPEG(82), mimeType: 'image/jpeg' };
        }
        return { buffer: resized.toPNG(), mimeType: 'image/png' };
    } catch (e) {
        return { buffer, mimeType }; // nie fatal — dann eben Originalgroesse
    }
}

// Helper function to convert images to base64 for PDF export
// H2: baseDir = directory of the markdown file whose images we're embedding.
// Falls back to the legacy currentFilePath global when omitted. Threading it
// explicitly matters for batch export and multi-tab GUI export, where the global
// points at whatever file was touched last — images then resolved against the
// wrong directory AND were blocked by the path-traversal guard.
async function convertImagesToBase64(htmlContent, baseDir = null) {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    let match;
    const imagePromises = [];

    while ((match = imgRegex.exec(htmlContent)) !== null) {
        const fullImgTag = match[0];
        const imgSrc = match[1];

        // Skip if already base64
        if (imgSrc.startsWith('data:')) {
            continue;
        }

        imagePromises.push(
            convertImageToBase64(imgSrc, baseDir).then(base64 => ({
                originalTag: fullImgTag,
                originalSrc: imgSrc,
                base64: base64
            })).catch(err => {
                console.log(`Failed to convert image ${imgSrc}:`, err);
                return null;
            })
        );
    }

    const results = await Promise.all(imagePromises);

    for (const result of results) {
        if (result && result.base64) {
            htmlContent = htmlContent.replace(
                result.originalTag,
                result.originalTag.replace(result.originalSrc, result.base64)
            );
        }
    }

    return htmlContent;
}

async function convertImageToBase64(imagePath, baseDirOverride = null) {
    try {
        const currentFilePath = getCurrentFilePath();
        // Handle different types of paths
        let fullPath;

        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            // A4: Web URL with timeout, size limit, and redirect limit
            const https = require('https');
            const http = require('http');
            const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
            const FETCH_TIMEOUT = 10000; // 10s
            const MAX_REDIRECTS = 5;

            return new Promise((resolve, reject) => {
                let redirectCount = 0;

                function fetchUrl(url) {
                    const client = url.startsWith('https://') ? https : http;
                    const req = client.get(url, { timeout: FETCH_TIMEOUT }, (response) => {
                        // Handle redirects
                        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                            redirectCount++;
                            if (redirectCount > MAX_REDIRECTS) {
                                reject(new Error(`Too many redirects (>${MAX_REDIRECTS})`));
                                return;
                            }
                            // L4: resolve relative/protocol-relative Location headers safely
                            let redirectUrl;
                            try {
                                redirectUrl = new URL(response.headers.location, url).href;
                            } catch (e) {
                                resolve(null); // unparseable redirect — skip image
                                return;
                            }
                            response.resume(); // consume response
                            fetchUrl(redirectUrl);
                            return;
                        }

                        // Check content-length header
                        const contentLength = parseInt(response.headers['content-length'], 10);
                        if (contentLength && contentLength > MAX_IMAGE_SIZE) {
                            response.resume();
                            resolve(null); // Skip oversized image
                            return;
                        }

                        const chunks = [];
                        let totalSize = 0;
                        response.on('data', chunk => {
                            totalSize += chunk.length;
                            if (totalSize > MAX_IMAGE_SIZE) {
                                response.destroy();
                                resolve(null); // Skip oversized image
                                return;
                            }
                            chunks.push(chunk);
                        });
                        response.on('end', () => {
                            const buffer = Buffer.concat(chunks);
                            const mimeType = (response.headers['content-type'] || 'image/png').split(';')[0].trim();
                            const scaled = downscaleImageForPdf(buffer, mimeType);
                            resolve(`data:${scaled.mimeType};base64,${scaled.buffer.toString('base64')}`);
                        });
                    });
                    req.on('error', reject);
                    req.on('timeout', () => {
                        req.destroy();
                        resolve(null); // Skip timed-out image
                    });
                }

                fetchUrl(imagePath);
            });
        } else if (path.isAbsolute(imagePath)) {
            // Absolute path
            fullPath = path.resolve(imagePath);
        } else {
            // Relative path - resolve relative to the owning file's directory (H2),
            // legacy global, or working directory
            const relBase = baseDirOverride || (currentFilePath ? path.dirname(currentFilePath) : null);
            fullPath = relBase ? path.resolve(relBase, imagePath) : path.resolve(imagePath);
        }

        // Path traversal guard: fullPath must stay within the Markdown file's directory subtree.
        // Blocks malicious markdown like ![](../../../../etc/passwd) or ![](/Users/victim/.ssh/id_rsa)
        // from leaking arbitrary files into the exported PDF. If no base directory is known
        // (CLI without source context), falls back to process.cwd() as the root.
        const baseDir = baseDirOverride
            ? path.resolve(baseDirOverride)
            : (currentFilePath ? path.resolve(path.dirname(currentFilePath)) : process.cwd());
        const rel = path.relative(baseDir, fullPath);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            console.log(`Blocked out-of-tree image path: ${imagePath} (resolved to ${fullPath}, base ${baseDir})`);
            return null;
        }

        // Read local file
        const imageBuffer = await fs.readFile(fullPath);
        const ext = path.extname(fullPath).toLowerCase();

        let mimeType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.svg') mimeType = 'image/svg+xml';
        else if (ext === '.webp') mimeType = 'image/webp';

        const scaled = downscaleImageForPdf(imageBuffer, mimeType);
        const base64 = scaled.buffer.toString('base64');
        return `data:${scaled.mimeType};base64,${base64}`;
    } catch (error) {
        console.log(`Error converting image ${imagePath}:`, error);
        return null;
    }
}

module.exports = { PDF_IMAGE_MAX_WIDTH, downscaleImageForPdf, convertImagesToBase64, convertImageToBase64 };
