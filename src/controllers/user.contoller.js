import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {uploadOnCloudnary} from '../utils/cloudnary.js'
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, 'Something went wrong while generating refresh and access token.')
    }
}

const registerUser = asyncHandler(async(req, res) => {
    //algorithm for designing ==>
    //get user details from frontend
    //validation - not empty
    //check if user already exists: username, email
    //check for images, check for avatar
    //upload them to cloudnary, avatar
    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creation
    //return response

    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Body:", req.body);
    console.log("Files:", req.files);

    const {fullName, email, username, password} = req.body ?? {};
    console.log('email: ', email);

    if(
        [fullName, email, username, password].some((field) => (
            field?.trim() === ""))
    ){
        throw new ApiError(400, 'All fields are required.')
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, 'Avatar file is not required')
    }
    
    const avatar = await uploadOnCloudnary(avatarLocalPath)
    const coverImage = await uploadOnCloudnary(coverImageLocalPath)

    if(!avatar) throw new ApiError(400, 'Avatar file is required.')

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url||"",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if(!createdUser){
        throw new ApiError(500, 'Something went wrong while registering the user.')
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, 'User Registered Successfully.')
    )
})

const loginUser = asyncHandler(async(req, res) => {
    //req.body -> data
    //username or email
    //find the user
    //password check
    //access and refresh token
    //send cookie
    const {email, username, password} = req.body
    
    if (!(email || username)) {
        throw new ApiError(400, 'username and password is required.')
    }

    User.findOne({
        or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, 'User does not exist.')
    }

    const isPasswordValid = await user.isPasswordValid(password)

    if(!isPasswordValid){
        throw new ApiError(401, 'Invalid user credentials.')
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
    const loggedInUser = await User.findById(user._id).select('-password -refreshToken') 

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie('AccessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            'User logged in successfully.'
        )
    )

})

const logoutUser = asyncHandler(async(req, res) => {
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(201)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, 'User logged out successfully.'))
})

export {registerUser}