import {v2 as cloudnary} from 'cloudinary'
import { log } from 'console';
import fs from 'fs'

cloudnary.config({
    cloud_name : process.env.CLOUDNARY_CLOUD_NAME,
    api_key : process.env.CLOUDNARY_API_KEY,
    api_secret : process.env.CLOUDNARY_API_SECRET
});

const uploadResult = async(localFilePath) => {
   try{
    if(!localFilePath) return null
    //upload file
    const response = await cloudinary.uploader
       .upload(localFilePath, {
        resource_type: 'auto',
       })
       //uploaded
       console.log('file is uploaded successfully', response.url);
       return response;
   } catch(error){
        fs.unlinkSync(localFilePath) // remove the saved file (locally) as upload operation got failed.
        return null;
   }
}

export {uploadResult}