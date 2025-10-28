import express from 'express'
import { blogController } from '../controllers/blog.controller.js'
import { blogRateLimiter, shareRateLimiter } from '~/middlewares/limiter.middleware.js'
import { verifyToken, verifyAdmin } from '../middlewares/auth.middleware.js'
import { blogValidation } from '../validations/blog.validation.js'
import { uploadFiles } from '../middlewares/multer.middleware.js';
import { uploadBlogFiles } from '../middlewares/cloudinary.middleware.js';
//import /middlewares/cloudinary.middleware.js'

const Router = express.Router()

const blogUploads = uploadFiles.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'album', maxCount: 10 },
  { name: 'content', maxCount: 20 }
]);

Router.get('/', blogController.getBlogs)
Router.get('/search', blogValidation.getBlogs, blogController.searchBlogs)
Router.get('/popular', blogController.getPopularBlogs)
Router.post('/', blogRateLimiter, verifyToken, blogUploads, uploadBlogFiles, blogValidation.createBlog, blogController.createBlog)

Router.get('/slug/:slug', blogController.getBlogBySlug)
Router.get('/:id', blogController.getBlogById)
Router.get('/pending/:id', blogController.getBlogByIdPending)
Router.patch('/:id/privacy', verifyToken, blogValidation.updateBlogPrivacy, blogController.updateBlogPrivacy)
Router.delete('/:id', verifyToken, blogController.deleteBlog)
Router.put('/:id', verifyToken, blogUploads, uploadBlogFiles, blogValidation.updateBlog, blogController.updateBlog)
Router.patch('/:id/like', verifyToken, blogController.likeBlog)
Router.patch('/:id/share', shareRateLimiter, verifyToken, blogController.shareBlog)
Router.post('/report/:id', verifyToken, blogValidation.validateBlogId, blogValidation.validateReport, blogController.reportBlog)
Router.get('/place/:identifier', blogController.getBlogsByPlaceIdentifier)
Router.get('/ward/:wardId', blogController.getBlogsByWard)

export const blogRoute = Router