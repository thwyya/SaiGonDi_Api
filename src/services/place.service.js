import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import { mongoose } from 'mongoose'
import PlaceModel from '~/models/Place.model.js'
import UserModel from '~/models/User.model.js'
import CheckinModel from '~/models/Checkin.model.js'
import ReviewModel from '~/models/Review.model.js'

import { OBJECT_ID_RULE } from '~/utils/validators'
import CategoryModel from '~/models/Category.model'

const queryGenerate = async (id) => {
  if (id.match(OBJECT_ID_RULE)) {
    return { _id: new mongoose.Types.ObjectId(id) }
  }
  return { slug: id }
}


const createNew = async (placeData, userId) => {
  try {
    const newPlace = await PlaceModel.create({
      ...placeData,
      createdBy: userId,
      status: 'pending'
    })
    return newPlace
  } catch (error) {
    throw error
  }
}

const getApprovedPlaces = async (queryParams) => {
  try {
    const sortByMapping = {
      'popular': 'viewCount',
      'newest': 'createdAt',
      'rating': 'avgRating',
    }
    
    const page = parseInt(queryParams.page, 10) || 1
    const limit = parseInt(queryParams.limit, 10) || 10
    const startIndex = (page - 1) * limit

    const sortBy = queryParams.sortBy || 'rating'
    const sortOrder = -1

    let matchConditions = { status: 'approved' }
    if (queryParams.categories && queryParams.categories !== 'all') {
      matchConditions.categories = queryParams.categories
    }
    
    if (queryParams.minRating) {
      matchConditions.avgRating = { $gte: parseFloat(queryParams.minRating) }
    }

    if (queryParams.services) {
      try {
        let serviceIds = []
        
        if (Array.isArray(queryParams.services)) {
          serviceIds = queryParams.services
            .filter(id => id && typeof id === 'string')
            .map(id => new mongoose.Types.ObjectId(id))
        } else if (typeof queryParams.services === 'string') {
          if (queryParams.services.includes(',')) {
            serviceIds = queryParams.services.split(',')
              .map(id => id.trim())
              .filter(id => id)
              .map(id => new mongoose.Types.ObjectId(id))
          } else {
            serviceIds = [new mongoose.Types.ObjectId(queryParams.services)]
          }
        }        
        if (serviceIds.length > 0) {
          matchConditions.services = { $all: serviceIds }
        }
      } catch (error) {
        console.error('Error processing service IDs:', queryParams.services, error)
      }
    } else {
      console.log('No services parameter found')
    }

    const places = await PlaceModel.find(matchConditions)
      .populate({
        path: 'categories',
        select: 'name icon _id'  
      })
      .populate({
        path: 'services',
        select: 'name description _id'
      })
      .populate({
        path: 'ward',
        select: 'name'
      })
      .sort({ [sortByMapping[sortBy] || 'rating']: sortOrder })
      .skip(startIndex)
      .limit(limit)
      .select('name slug address avgRating images services categories ward viewCount createdAt totalRatings')

    const total = await PlaceModel.countDocuments(matchConditions)  

    return {
      places,
      pagination: {
        total,
        limit,
        page,
        totalPages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    throw error
  }
}

const getPlacesMapdata = async (queryParams) => {
  try {
    const sortByMapping = {
      // location: 'location',
      latest: 'createdAt',
      rating: 'avgRating'
    }
    const page = parseInt(queryParams.page, 10) || 1
    const limit = parseInt(queryParams.limit, 10) || 10
    const startIndex = (page - 1) * limit

    const sortBy = queryParams.sortBy || 'createdAt'
    const sortOrder = queryParams.sortOrder === 'desc' ? -1 : 1
    const places = await PlaceModel.find({ status: 'approved' })
      .populate({
        path: 'categories',
        select: 'name icon'
      })
      .populate({
        path: 'ward',
        select: 'name'
      })
      .sort({ [sortByMapping[sortBy]]: sortOrder })
      .skip(startIndex)
      .limit(limit)
      .select('name slug category address location avgRating images services')
    const total = await PlaceModel.countDocuments({ status: 'approved' })

    const returnPlaces = {
      places,
      pagination: {
        total,
        limit,
        page,
        totalPages: Math.ceil(total / limit)
      }
    }
    return returnPlaces
  } catch (error) {
    throw error
  }
}

const getAllPlaces = async (queryParams) => {
  try {
    const sortByMapping = {
      // location: 'location',
      latest: 'createdAt',
      rating: 'avgRating'
    }
    const page = parseInt(queryParams.page, 10) || 1
    const limit = parseInt(queryParams.limit, 10) || 10
    const startIndex = (page - 1) * limit
    const sortBy = queryParams.sortBy || 'createdAt'
    const sortOrder = queryParams.sortOrder === 'desc' ? -1 : 1
    const places = await PlaceModel.find()
      .populate({
        path: 'categories',
        select: 'name icon'
      })
      .populate({
        path: 'ward',
        select: 'name'
      })
      .populate({
        path: 'services',
        select:'name description'
      })
      .sort({ [sortByMapping[sortBy]]: sortOrder })
      .skip(startIndex)
      .limit(limit)
    const total = await PlaceModel.countDocuments()
    return {
      places,
      pagination: {
        total,
        limit,
        page,
        totalPages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    throw error
  }
}

const getPlaceDetails = async (placeId) => {
  try {
    const query = await queryGenerate(placeId)

    const place = await PlaceModel.findOneAndUpdate(
      { ...query, status: 'approved' },
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .populate({ path: 'categories', select: 'name icon description' })
      .populate({ path: 'likeBy', select: 'firstName lastName avatar' })
      .populate({ path: 'ward', select: 'name' })
      .select(
        'categories status name slug description address district ward location avgRating totalRatings totalLikes likeBy images viewCount services'
      );

    if (!place || place.status !== 'approved') {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Place not found')
    }

    // Lấy danh sách đánh giá
    const reviews = await ReviewModel.find({ placeId: place._id, _hidden: false })
      .populate('userId', 'name avatar')
      .select('comment rating createdAt')
      .sort({ createdAt: -1 })

    return {
      ...place.toObject(),
      reviews
    }
  } catch (error) {
    throw error
  }
}


const updatePlace = async (placeId, updateData) => {
  try {
    const updatedPlace = await PlaceModel.findByIdAndUpdate(placeId, {
      ...updateData,
      updatedAt: new Date()
    }, { new: true })
    if (!updatedPlace) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Place not found')
    }
    return updatedPlace
  }
  catch (error) {
    throw error
  }
}

const destroyPlace = async (placeId) => {
  try {
    return await updatePlace(placeId, { status: 'hidden' })
  } catch (error) {
    throw error
  }
}

const likePlace = async (placeId, userId) => {
  try {
    const place = await PlaceModel.findById(placeId)
    if (!place || place.status !== 'approved') {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Place not found')
    }
    if (place.likeBy.includes(new mongoose.Types.ObjectId(userId))) {
      place.likeBy.pull(new mongoose.Types.ObjectId(userId))
    } else {
      place.likeBy.push(new mongoose.Types.ObjectId(userId))
    }
    await place.save()
    await place.updateTotalLikes()
    return place
  } catch (error) {
    throw error
  }
}

const addToFavorites = async (placeId, userId) => {
  try {
    const user = await UserModel.findById(userId)
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
    }
    if (user.favorites.includes(placeId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Place already in favorites')
    }
    user.favorites.push(placeId)
    await user.save()
    return user
  } catch (error) {
    throw error
  }
}

const addViewCount = async (placeId, userId) => {
  try {
    const place = await PlaceModel.findById(placeId)
    if (!place || place.status !== 'approved') {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Place not found')
    }
    place.viewCount += 1
    await place.save()
    return place
  } catch (error) {
    throw error
  }
}

const removeFromFavorites = async (placeId, userId) => {
  try {
    const user = await UserModel.findById(userId)
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
    }
    if (!user.favorites.includes(placeId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Place not in favorites')
    }
    user.favorites.pull(placeId)
    await user.save()
    return user
  } catch (error) {
    throw error
  }
}

const checkinPlace = async (placeId, userId, checkinData) => {
  try {
    const user = await UserModel.findById(userId)
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
    }
    const place = await PlaceModel.findById(placeId)
    if (!place || place.status !== 'approved') {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Place not found')
    }
    const existingCheckin = await CheckinModel.findOne({ userId, placeId })
    if (existingCheckin) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'User has already checked in at this place')
    }
    const newCheckin = await CheckinModel.create({
      userId,
      placeId,
      ...checkinData
    })
    return newCheckin
  } catch (error) {
    throw error
  }
}

const getFavoritePlaces = async (userId) => {
  try {
    const user = await UserModel.findById(userId).populate('favorites')
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
    }
    return user.favorites
  } catch (error) {
    throw error
  }
}

const approvePlace = async (placeId, adminId) => {
  try {
    const place = await PlaceModel.findById(placeId)
    if (!place) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy địa điểm.')
    }
    if (place.status === 'approved') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Địa điểm đã được phê duyệt.')
    }
    place.status = 'approved'
    place.verifiedBy = adminId
    await place.save()
    return place
  } catch (error) {
    throw error
  }
}

const updatePlaceCoordinates = async (placeId, latitude, longitude) => {
  try {
    const place = await PlaceModel.findById(placeId)
    if (!place) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy địa điểm.')
    }

    place.location.coordinates = [longitude, latitude]
    place.updatedAt = new Date()
    await place.save()

    return place
  } catch (error) {
    throw error
  }
}

const getAdminPlaceDetails = async (placeId) => {
  try {
    const place = await PlaceModel.findById(placeId)
      .populate({
        path: 'categories',
        select: 'name icon description'
      })
      .populate({
        path: 'likeBy',
        select: 'firstName lastName avatar'
      })
      .populate({
        path: 'createdBy',
        select: 'firstName lastName email'
      })
      .populate({
        path: 'verifiedBy',
        select: 'firstName lastName email'
      })
    if (!place) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy địa điểm.')
    }
    return place
  } catch (error) {
    throw error
  }
}

const getUserSuggestedPlaces = async (userId) => {
  try {
    const suggestedPlaces = await PlaceModel.find({
      createdBy: userId
    })
    return suggestedPlaces
  } catch (error) {
    throw error
  }
}

const getUserCheckins = async (userId) => {
  try {
    const checkins = await CheckinModel.find({ userId })
      .populate({
        path: 'placeId',
        select: 'name address ward district avgRating totalRatings images',
        populate: {
          path: 'ward',
          select: 'name'
        }
      });
    return checkins;
  } catch (error) {
    throw error;
  }
};


const searchPlaces = async (filterCriteria) => {
  try {
    const query = {}
    if (filterCriteria.query) {
      query.name = { $regex: filterCriteria.query, $options: 'i' } // Case-insensitive search
    }
    if (filterCriteria.category) {
      const category = await CategoryModel.findOne({ $or: [{ slug: filterCriteria.category }, { _id: filterCriteria.category }] }).select('_id')
      if (category) {
        query.categories = category._id
      }
    }
    if (filterCriteria.address) {
      query.address = { $regex: filterCriteria.address, $options: 'i' } // Case-insensitive search
    }
    if (filterCriteria.district) {
      query.district = { $regex: filterCriteria.district, $options: 'i' } // Case-insensitive search
    }
    if (filterCriteria.ward) {
      query.ward = { $regex: filterCriteria.ward, $options: 'i' } // Case-insensitive search
    }
    if (filterCriteria.avgRating) {
      query.avgRating = { $gte: parseFloat(filterCriteria.avgRating) } // Minimum average rating
    }
    if (filterCriteria.totalRatings) {
      query.totalRatings = { $gte: parseInt(filterCriteria.totalRatings) } // Minimum total ratings
    }
    const places = await PlaceModel.find({ ...query, status: 'approved' })
      .populate({
        path: 'categories',
        select: 'name icon'
      })
      .select('name slug address avgRating totalRatings categories location images')
      .limit(50) // Limit results for performance
    return places
  } catch (error) {
    throw error
  }
}

const getNearbyPlaces = async (queryParams) => {
  try {
    const { latitude, longitude, distance } = queryParams;
    const places = await PlaceModel.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(distance)
        }
      },
      status: 'approved'
    })
      .populate({
        path: 'categories',
        select: 'name icon'
      })
      .select('name slug address avgRating images location')
      .limit(20); // Limit results for performance

    return places;
  } catch (error) {
    throw error;
  }
}
const getHotPlaces = async () => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const hotPlaces = await CheckinModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: now }
        }
      },
      {
        $group: {
          _id: '$placeId',
          totalCheckins: { $sum: 1 }
        }
      },
      { $sort: { totalCheckins: -1 } },
      {
        $lookup: {
          from: 'places', // tên collection
          localField: '_id',
          foreignField: '_id',
          as: 'place'
        }
      },
      { $unwind: '$place' },
      {
        $project: {
          _id: 0,
          placeId: '$_id',
          totalCheckins: 1,
          name: '$place.name',
          address: '$place.address',
          image: { $arrayElemAt: ['$place.images', 0] }
        }
      }
    ])

    return hotPlaces
  } catch (error) {
    throw error
  }
}

export const placeService = {
  createNew,
  getAllPlaces,
  getApprovedPlaces,
  searchPlaces,
  getPlacesMapdata,
  addViewCount,
  getUserSuggestedPlaces,
  getAdminPlaceDetails,
  getPlaceDetails,
  updatePlace,
  destroyPlace,
  likePlace,
  addToFavorites,
  removeFromFavorites,
  checkinPlace,
  getFavoritePlaces,
  approvePlace,
  updatePlaceCoordinates,
  getUserCheckins,
  getNearbyPlaces,
  getHotPlaces
}

