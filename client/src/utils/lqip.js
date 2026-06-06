export const generateLQIP = (file) => {
    return new Promise((resolve) => {
        if (!file || !file.type.startsWith("image/") || file.type === "image/gif") {
            return resolve("");
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = 16;
                canvas.height = 16;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, 16, 16);
                    try {
                        const dataUrl = canvas.toDataURL("image/jpeg", 0.2);
                        resolve(dataUrl);
                    } catch (err) {
                        resolve("");
                    }
                } else {
                    resolve("");
                }
            };
            img.onerror = () => resolve("");
            img.src = e.target.result;
        };
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
    });
};
