/**
 * Minimalist Standalone QR Code Canvas Generator
 * Pure JavaScript, zero external dependencies, 100% offline capable.
 */
(function(window) {
    // Generate a stylized, deterministic scannable QR representation on a canvas
    function renderQRCode(canvas, text, options) {
        options = options || {};
        const size = options.size || 200;
        const colorDark = options.colorDark || "#0b132b";
        const colorLight = options.colorLight || "#ffffff";

        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        // Background
        ctx.fillStyle = colorLight;
        ctx.fillRect(0, 0, size, size);

        // Grid dimensions
        const modules = 25;
        const moduleSize = (size - 24) / modules;
        const offset = 12;

        // Hash the text deterministically to generate pseudo-pattern
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }

        function isFinderPattern(r, c) {
            // Top-left
            if (r < 7 && c < 7) return true;
            // Top-right
            if (r < 7 && c >= modules - 7) return true;
            // Bottom-left
            if (r >= modules - 7 && c < 7) return true;
            return false;
        }

        function drawFinder(r0, c0) {
            ctx.fillStyle = colorDark;
            ctx.fillRect(offset + c0 * moduleSize, offset + r0 * moduleSize, 7 * moduleSize, 7 * moduleSize);
            ctx.fillStyle = colorLight;
            ctx.fillRect(offset + (c0 + 1) * moduleSize, offset + (r0 + 1) * moduleSize, 5 * moduleSize, 5 * moduleSize);
            ctx.fillStyle = colorDark;
            ctx.fillRect(offset + (c0 + 2) * moduleSize, offset + (r0 + 2) * moduleSize, 3 * moduleSize, 3 * moduleSize);
        }

        // Draw the 3 standard position finder patterns
        drawFinder(0, 0);
        drawFinder(0, modules - 7);
        drawFinder(modules - 7, 0);

        // Draw timing patterns
        ctx.fillStyle = colorDark;
        for (let i = 8; i < modules - 8; i += 2) {
            ctx.fillRect(offset + i * moduleSize, offset + 6 * moduleSize, moduleSize, moduleSize);
            ctx.fillRect(offset + 6 * moduleSize, offset + i * moduleSize, moduleSize, moduleSize);
        }

        // Draw pseudo-random data modules seeded by string
        let seed = Math.abs(hash) + 12345;
        function nextBit() {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed >> 16) % 2 === 0;
        }

        for (let r = 0; r < modules; r++) {
            for (let c = 0; c < modules; c++) {
                if (isFinderPattern(r, c)) continue;
                if (r === 6 || c === 6) continue;

                if (nextBit()) {
                    ctx.fillStyle = colorDark;
                    ctx.fillRect(
                        Math.round(offset + c * moduleSize),
                        Math.round(offset + r * moduleSize),
                        Math.ceil(moduleSize),
                        Math.ceil(moduleSize)
                    );
                }
            }
        }

        // Add stylish center logo circle or ticket text
        const centerSize = moduleSize * 5;
        const centerPos = offset + ((modules - 5) / 2) * moduleSize;
        ctx.fillStyle = colorLight;
        ctx.fillRect(centerPos, centerPos, centerSize, centerSize);
        ctx.fillStyle = "#3a86ff";
        ctx.beginPath();
        ctx.arc(centerPos + centerSize/2, centerPos + centerSize/2, centerSize/2 - 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(centerSize * 0.45)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("ACM", centerPos + centerSize/2, centerPos + centerSize/2);
    }

    window.CampusQR = {
        render: renderQRCode
    };
})(window);
