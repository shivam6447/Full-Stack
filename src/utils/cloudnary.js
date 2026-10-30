import { v2 as cloudnary } from 'cloudinary';
import fs from 'fs';

const configureCloudinary = () => {
    cloudnary.config({
        cloud_name: process.env.CLOUDNARY_CLOUD_NAME,
        api_key: process.env.CLOUDNARY_API_KEY,
        api_secret: process.env.CLOUDNARY_API_SECRET
    });
};

// Initial config attempt
configureCloudinary();

const uploadOnCloudnary = async (localFilePath) => {
    try {
        configureCloudinary();
        if (!localFilePath) return null;

        const response = await cloudnary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        });

        // Remove local file after successful upload
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        console.log('File uploaded successfully to Cloudinary:', response.url);
        return response;
    } catch (error) {
        // Remove local file on failure
        if (localFilePath && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        console.error('Cloudinary upload error:', error);
        return null;
    }
};

export { uploadOnCloudnary };
