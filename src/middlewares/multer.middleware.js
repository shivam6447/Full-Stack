import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const tempDir = path.resolve("public/temp");

fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },

    filename: function (req, file, cb) {
        crypto.randomBytes(16, function (err, raw) {
            if (err) return cb(err);

            const ext = path.extname(file.originalname);
            cb(null, `${file.fieldname}-${raw.toString("hex")}${ext}`);
        });
    }
});

export const upload = multer({ storage });
