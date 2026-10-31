import fs from 'fs';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { uploadOnCloudnary } from '../utils/cloudnary.js';
import { User } from '../models/user.model.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const removeLocalFiles = (...paths) => {
    paths.forEach((p) => {
        if (p && fs.existsSync(p)) {
            try {
                fs.unlinkSync(p);
            } catch (err) {
                console.error(`Failed to delete local file: ${p}`, err);
            }
        }
    });
};

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, 'Something went wrong while generating refresh and access token.');
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password } = req.body ?? {};

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (
        [fullName, email, username, password].some(
            (field) => !field || (typeof field === 'string' && field.trim() === '')
        )
    ) {
        removeLocalFiles(avatarLocalPath, coverImageLocalPath);
        throw new ApiError(400, 'All fields (fullName, email, username, password) are required.');
    }

    const existedUser = await User.findOne({
        $or: [{ username: username.toLowerCase() }, { email }]
    });

    if (existedUser) {
        removeLocalFiles(avatarLocalPath, coverImageLocalPath);
        throw new ApiError(409, 'User with email or username already exists.');
    }

    if (!avatarLocalPath) {
        removeLocalFiles(coverImageLocalPath);
        throw new ApiError(400, 'Avatar file is required.');
    }

    const avatar = await uploadOnCloudnary(avatarLocalPath);
    const coverImage = coverImageLocalPath ? await uploadOnCloudnary(coverImageLocalPath) : null;

    if (!avatar) {
        removeLocalFiles(coverImageLocalPath);
        throw new ApiError(400, 'Avatar file upload failed.');
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || '',
        email,
        password,
        username: username.toLowerCase()
    });

    const createdUser = await User.findById(user._id).select('-password -refreshToken');

    if (!createdUser) {
        throw new ApiError(500, 'Something went wrong while registering the user.');
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, 'User Registered Successfully.')
    );
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body ?? {};

    if (!(email || username)) {
        throw new ApiError(400, 'Username or email is required.');
    }

    if (!password) {
        throw new ApiError(400, 'Password is required.');
    }

    const user = await User.findOne({
        $or: [
            ...(username ? [{ username: username.toLowerCase() }] : []),
            ...(email ? [{ email }] : [])
        ]
    });

    if (!user) {
        throw new ApiError(404, 'User does not exist.');
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid user credentials.');
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .cookie('accessToken', accessToken, options)
        .cookie('refreshToken', refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                'User logged in successfully.'
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie('accessToken', options)
        .clearCookie('refreshToken', options)
        .json(new ApiResponse(200, {}, 'User logged out successfully.'));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, 'Unauthorized request.');
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, 'Invalid Refresh Token.');
        }

        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, 'Refresh token is either expired or used.');
        }

        const options = {
            httpOnly: true,
            secure: true
        };

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        return res
            .status(200)
            .cookie('accessToken', accessToken, options)
            .cookie('refreshToken', newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    'Access token refreshed'
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || 'Invalid refresh Token.');
    }
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
};
