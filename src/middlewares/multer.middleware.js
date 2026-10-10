import multer from 'multer'

const storage = multer.diskStorage({
    destination: function (req, res, cb) {
        cb(null, '/tmp/my-uploads')
    },
    filename: function (req, file, cb) {
        crypto.randomBytes(16, function (err, raw) {
            if (err) return cb(err)
            cb(null, file.fieldname + '-' + raw.toString('hex'))
        })
    }
})

export const upload = multer({ 
    storage,
})