// Entry for bundling the "common" hljs subset (~25 popular languages) to vendor/highlight.min.js
// The "common" bundle is significantly smaller than the full 190-language build.
import hljs from 'highlight.js/lib/common';
if (typeof window !== 'undefined') window.hljs = hljs;
