import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError.js'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators.js'

const idRule = Joi.object({
  id: Joi.string().pattern(OBJECT_ID_RULE).required().messages({
    'string.base': 'ID must be a string',
    'string.pattern.base': OBJECT_ID_RULE_MESSAGE
  })
})

const createNew = async (req, res, next) => {
  const validationRule = Joi.object({
    name: Joi.string().min(3).required().messages({
      'string.base': 'name must be a string',
      'string.empty': 'name cannot be empty',
      'string.min': 'name must be at least 3 characters long'
    }),
    description: Joi.string().min(10).required().messages({
      'string.base': 'description must be a string',
      'string.empty': 'description cannot be empty',
      'string.min': 'description must be at least 10 characters long'
    }),
    categories: Joi.array().items(Joi.string().pattern(OBJECT_ID_RULE).required().messages({
      'string.base': 'categories must be a string',
      'string.empty': 'categories cannot be empty',
      'string.pattern.base': OBJECT_ID_RULE_MESSAGE 
    })).required().messages({
      'array.base': 'categories must be an array',
      'array.items': 'categories must contain valid ObjectId strings'
    }),
    address: Joi.string().min(5).required().messages({
      'string.base': 'address must be a string',
      'string.empty': 'address cannot be empty',
      'string.min': 'address must be at least 5 characters long'
    }),
    services: Joi.array().items(Joi.string().pattern(OBJECT_ID_RULE).required().messages({
      'string.base': 'services must be a string',
      'string.empty': 'services cannot be empty',
      'string.pattern.base': OBJECT_ID_RULE_MESSAGE
    })).required().messages({
      'array.base': 'services must be an array',
      'array.items': 'services must contain valid ObjectId strings'
    }),
    district: Joi.string().min(2).required().messages({
      'string.base': 'district must be a string',
      'string.empty': 'district cannot be empty',
      'string.min': 'district must be at least 2 characters long'
    }),
    ward: Joi.string().pattern(OBJECT_ID_RULE).required().messages({
      'string.base': 'ward must be a string',
      'string.empty': 'ward cannot be empty',
      'string.pattern.base': OBJECT_ID_RULE_MESSAGE
    }),
    location: Joi.object({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array().ordered(
        Joi.number().min(-180).max(180).required(),
        Joi.number().min(-90).max(90).required()
      ).length(2).required()
    }),
    images: Joi.array().items(
      Joi.string().uri().messages({
        'string.base': 'each image must be a string',
        'string.uri': 'each image must be a valid URL'
      })
    ).min(1).required().messages({
      'array.base': 'images must be an array of strings',
      'array.min': 'at least 1 image is required'
    }),
  })
  try {
    if (req.body.location && typeof req.body.location === 'string') {
      req.body.location = JSON.parse(req.body.location)
    }
    if (req.body.categories && typeof req.body.categories === 'string') {
      req.body.categories = JSON.parse(req.body.categories)
    }
    if (req.body.services && typeof req.body.services === 'string') {
      req.body.services = JSON.parse(req.body.services)
    }
    if (req.body.ward && typeof req.body.ward === 'string') {
      req.body.ward = JSON.parse(req.body.ward)[0]
    }
    const data = req?.body ? req.body : {}
    await validationRule.validateAsync(data, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

const pagingValidate = async (req, res, next) => {
  const pagingRule = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    categories: Joi.string().pattern(OBJECT_ID_RULE).messages({
      'string.base': 'categories must be a string',
      'string.pattern.base': OBJECT_ID_RULE_MESSAGE
    }),
    minRating: Joi.number().min(0).max(5).messages({
      'number.base': 'minRating must be a number',
      'number.min': 'minRating must be at least 0',
      'number.max': 'minRating must be at most 5'
    }),
    services: Joi.alternatives().try(
      Joi.string().pattern(OBJECT_ID_RULE).messages({
        'string.pattern.base': OBJECT_ID_RULE_MESSAGE
      }),
      Joi.string().custom((value, helpers) => {
        if (value.includes(',')) {
          const ids = value.split(',').map(id => id.trim());
          for (const id of ids) {
            if (!OBJECT_ID_RULE.test(id)) {
              return helpers.error('string.pattern.base', { value: id });
            }
          }
          return value;
        }
        if (!OBJECT_ID_RULE.test(value)) {
          return helpers.error('string.pattern.base', { value });
        }
        return value;
      }).messages({
        'string.pattern.base': OBJECT_ID_RULE_MESSAGE
      }),
      Joi.array().items(Joi.string().pattern(OBJECT_ID_RULE).messages({
        'string.base': 'each service must be a string',
        'string.pattern.base': OBJECT_ID_RULE_MESSAGE
      }))
    ).messages({
      'alternatives.match': 'services must be a string or array of strings'
    }),
    sortBy: Joi.string().valid('newest', 'rating', 'popular').default('rating'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }).unknown(true)
  
  try {
    if (req.query && req.query.services && typeof req.query.services === 'string' && req.query.services.includes(',')) {
      req.query.services = req.query.services.split(',').map(id => id.trim())
    }
    const data = req?.query ? { ...req.query } : {}
    await pagingRule.validateAsync(data, { abortEarly: false })
    next()
  } catch (error) {
    console.error('Validation error:', error)
    const errorMessage = error.message || error.details?.map(d => d.message).join(', ') || 'Validation error'
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, errorMessage))
  }
}

const updatePlaceCoordinates = async (req, res, next) => {
  const validationRule = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  })
  try {
    const placeIdData = req?.params || {}
    const data = req?.body ? req.body : {}
    await idRule.validateAsync(placeIdData, { abortEarly: false })
    await validationRule.validateAsync(data, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

const checkinPlace = async (req, res, next) => {
  const checkinRule = Joi.object({
    location: Joi.object({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array().items(Joi.number()).length(2)
    }).optional(),
    note: Joi.string().max(500).optional(),
    device: Joi.string().optional(),
    imgList: Joi.array().items(Joi.string()).optional()
  });

  try {
    const data = req?.body || {};
    const placeIdData = req?.params || {};

    await checkinRule.validateAsync(data, { abortEarly: false });
    await idRule.validateAsync(placeIdData, { abortEarly: false });

    next();
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, error.message));
  }
};
const searchValidate = async (req, res, next) => {
  const searchRule = Joi.object({
    query: Joi.string().min(3).messages({
      'string.base': 'query must be a string',
      'string.min': 'query must be at least 3 characters long'
    }).optional(),
    category: Joi.string().pattern(OBJECT_ID_RULE).messages({
      'string.base': 'category must be a string',
      'string.pattern.base': OBJECT_ID_RULE_MESSAGE
    }).optional(),
    address: Joi.string().min(5).messages({
      'string.base': 'address must be a string',
      'string.min': 'address must be at least 5 characters long'
    }).optional(),
    avgRating: Joi.number().min(0).max(5).messages({
      'number.base': 'avgRating must be a number',
      'number.min': 'avgRating must be at least 0',
      'number.max': 'avgRating must be at most 5'
    }).optional(),
    totalRatings: Joi.number().integer().min(0).messages({
      'number.base': 'totalRatings must be a number',
      'number.integer': 'totalRatings must be an integer',
      'number.min': 'totalRatings must be at least 0'
    }).optional(),
    district: Joi.string().min(2).messages({
      'string.base': 'district must be a string',
      'string.min': 'district must be at least 2 characters long'
    }).optional(),
    ward: Joi.string().min(2).messages({
      'string.base': 'ward must be a string',
      'string.min': 'ward must be at least 2 characters long'
    }).optional()
  }).unknown(true)
  try {
    const data = req?.query ? req.query : {}
    await searchRule.validateAsync(data, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

const nearbyPlaces = async (req, res, next) => {
  const nearbyRule = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    distance: Joi.number().min(1).default(1000) // distance in meters
  })
  try {
    const data = req?.query ? req.query : {}
    await nearbyRule.validateAsync(data, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const placeValidation = {
  createNew,
  pagingValidate,
  updatePlaceCoordinates,
  checkinPlace,
  searchValidate,
  nearbyPlaces
}