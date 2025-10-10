import express from 'express'
import { verifyToken } from '~/middlewares/auth.middleware.js'
import { placeValidation } from '~/validations/place.validation.js'
import { placeController } from '~/controllers/place.controller.js'
import { generalValidation } from '~/validations/general.validation'
import { uploadFiles } from '~/middlewares/multer.middleware.js'
import { uploadPlaceImages } from '~/middlewares/cloudinary.middleware.js'

const Router = express.Router()

Router.get('/search', placeValidation.searchValidate, placeController.searchPlaces)
Router.get('/nearby', verifyToken, placeValidation.nearbyPlaces, placeController.getNearbyPlaces)
Router.post('/suggest', verifyToken, uploadFiles.array('images', 10), uploadPlaceImages, placeValidation.createNew, placeController.createNew)
Router.get('/', placeValidation.pagingValidate, placeController.getApprovedPlaces)
Router.get('/map-data', placeValidation.pagingValidate, placeController.getPlacesMapdata)
Router.get('/hot', placeController.getHotPlaces)
Router.get('/:id', generalValidation.paramSlugValidate, placeController.getPlaceDetails)
Router.patch('/:id', verifyToken, generalValidation.paramIdValidate, placeController.likePlace)

Router.post('/:id/favorite', verifyToken, generalValidation.paramIdValidate, placeController.addToFavorites)
Router.post('/:id/view', placeController.addViewCount)
Router.delete('/:id/favorite', verifyToken, generalValidation.paramIdValidate, placeController.removeFromFavorites)
Router.post('/:id/checkin', verifyToken, placeValidation.checkinPlace, placeController.checkinPlace)

export const placeRoute = Router