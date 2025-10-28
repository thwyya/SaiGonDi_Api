import { blogService } from '../services/blog.service.js'
import Category from '../models/Category.model.js'
import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'
import ApiError from '../utils/ApiError.js'
import Blog from '../models/Blog.model.js'; 
import SearchLogModel from '~/models/SearchLog.model.js'

/**
 * @desc    Lấy danh sách bài viết công khai (có phân trang)
 * @route   GET /api/blogs
 * @access  Public
 */
const getBlogs = async (req, res, next) => {
  try {
    const { blogs, pagination } = await blogService.getBlogs(req.query, req.user)
    res.status(StatusCodes.OK).json({
      success: true,
      count: blogs.length,
      pagination,
      data: blogs
    })
  } catch (error) {
    next(error)
  }
}
/**
 * @desc    Lấy danh sách bài viết được xem nhiều nhất (có phân trang)
 * @route   GET /api/blogs/popular
 * @access  Public
 */
const getPopularBlogs = async (req, res, next) => {
  try {
    const { blogs, pagination } = await blogService.getPopularBlogs(req.query, req.user)
    res.status(StatusCodes.OK).json({
      success: true,
      count: blogs.length,
      pagination,
      data: blogs
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Lấy chi tiết một bài viết
 * @route   GET /api/blogs/:id
 * @access  Public (có kiểm tra quyền riêng tư)
 */
const getBlogById = async (req, res, next) => {
  try {
    const blog = await blogService.getBlogById(req.params.id, req.user)
    res.status(StatusCodes.OK).json({
      success: true,
      data: blog
    })
  } catch (error) {
    next(error)
  }
}
// thấy blog theo pending
const getBlogByIdPending = async (req, res, next) => {
  try {
    const blog = await blogService.getBlogByIdPending(req.params.id, req.user)
    res.status(StatusCodes.OK).json({
      success: true,
      data: blog
    })
  } catch (error) {
    next(error)
  }
}
// lấy chi tiết một bài viết bằng slug
const getBlogBySlug = async (req, res, next) => {
  try {
    const blog = await blogService.getBlogBySlug(req.params.slug, req.user)
    res.status(StatusCodes.OK).json({
      success: true,
      data: blog
    })
  } catch (error) {
    next(error)
  }
}

const getBlogsByAuthor = async (req, res, next) => {
  try {
    const blogs = await blogService.getBlogsByAuthor(req.params.authorId, req.user)
    res.status(StatusCodes.OK).json({
      success: true,
      data: blogs
    })
  } catch (error) {
    next(error)
  }
}
/**
 * @desc    Tạo bài viết mới
 * @route   POST /api/blogs
 * @access  Private
 */



const createBlog = async (req, res, next) => {
  try {
    let blogData = {
      ...req.body,
      mainImage: req.cloudFiles?.mainImage,
      album: req.cloudFiles?.album || req.body.album,
      content: [
        ...(req.body.content || []),
        ...(req.cloudFiles?.content || [])
      ]
    };

    // Handle categories being sent as a string
    if (blogData.categories && typeof blogData.categories === 'string') {
      blogData.categories = blogData.categories.split(',').map(id => id.trim());
    }

    if (blogData.categories && Array.isArray(blogData.categories)) {
      // Ensure all provided category IDs are valid ObjectIds
      const validCategoryIds = blogData.categories.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validCategoryIds.length !== blogData.categories.length) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid category ID(s) provided.');
      }
      blogData.categories = validCategoryIds;
    }

    // authorId được lấy từ token đã xác thực, không phải từ req.body
    const newBlog = await blogService.createBlog(blogData, req.user.id)
    res.status(StatusCodes.CREATED).json({
      success: true,
      data: newBlog
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Cập nhật chế độ riêng tư
 * @route   PATCH /api/blogs/:id/privacy
 * @access  Private (chỉ tác giả hoặc admin)
 */
const updateBlogPrivacy = async (req, res, next) => {
  try {
    const updatedBlog = await blogService.updateBlogPrivacy(
      req.params.id,
      req.body.privacy,
      req.user
    )
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Cập nhật quyền riêng tư thành công.',
      data: updatedBlog
    })
  } catch (error) {
    next(error)
  }
}

const updateBlogStatus = async (req, res, next) => {
  try {
    const updatedBlog = await blogService.updateBlogStatus(
      req.params.id,
      req.body.status,
      req.user
    )
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Cập nhật trạng thái bài viết thành công.',
      data: updatedBlog
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Thích/bỏ thích bài viết
 * @route   PATCH /api/blogs/:id/like
 * @access  Private
 */
const likeBlog = async (req, res, next) => {
  try {
    const updatedBlog = await blogService.likeBlog(
      req.params.id,
      req.user.id
    )
    res.status(StatusCodes.OK).json({
      success: true,
      data: updatedBlog
    })
  } catch (error) {
    next(error)
  }
}
const updateBlog = async (req, res, next) => {
  try {
    const blogId = req.params.id
    const user = req.user

    const updateData = {
      ...req.body,
      mainImage: req.cloudFiles?.mainImage || req.body.mainImage || null,
      album: req.cloudFiles?.album || req.body.album,
      content: [
        ...(req.body.content || []),
        ...(req.cloudFiles?.content || [])
      ]
    }

    // Handle categories being sent as a string
    if (updateData.categories && typeof updateData.categories === 'string') {
      updateData.categories = updateData.categories.split(',').map(id => id.trim());
    }

    if (updateData.categories && Array.isArray(updateData.categories)) {
      const validCategoryIds = updateData.categories.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validCategoryIds.length !== updateData.categories.length) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid category ID(s) provided.');
      }
      updateData.categories = validCategoryIds;
    }

    const updatedBlog = await blogService.updateBlog(blogId, updateData, user)
    res.status(StatusCodes.OK).json({ success: true, data: updatedBlog })
  } catch (error) {
    next(error)
  }
}
/**
 * @desc    Xóa bài viết
 * @route   DELETE /api/blogs/:id
 * @access  Private (chỉ tác giả hoặc admin)
 */
const deleteBlog = async (req, res, next) => {
  try {
    await blogService.deleteBlog(req.params.id, req.user)
    res.status(StatusCodes.OK).json({ success: true, message: 'Đã xóa bài viết thành công.' })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Share bài viết
 * @route   PATCH /api/blogs/:id/share
 * @access  Private
 */
const shareBlog = async (req, res, next) => {
  try {
    const blogId = req.params.id
    const userId = req.user.id // đồng bộ với các API khác

    const sharedBlog = await blogService.shareBlogById(blogId, userId)

    const originalBlog = await Blog.findById(blogId)

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Chia sẻ bài viết thành công',
      data: sharedBlog,
      shareCount: originalBlog.shareCount
    })
  } catch (error) {
    next(error)
  }
}

const getBlogsByPlaceIdentifier = async (req, res, next) => {
  try {
    const { identifier } = req.params
    const { blogs, pagination } = await blogService.getBlogsByPlaceIdentifier(identifier, req.query, req.user)
    res.status(StatusCodes.OK).json({
      success: true,
      count: blogs.length,
      pagination,
      data: blogs
    })
  } catch (error) {
    next(error)
  }
}

const getBlogsByWard = async (req, res, next) => {
  try {
    const { wardId } = req.params
    const { blogs, pagination } = await blogService.getBlogsByWard(wardId, req.query, req.user)
    res.status(StatusCodes.OK).json({
      success: true,
      count: blogs.length,
      pagination,
      data: blogs
    })
  } catch (error) {
    next(error)
  }
}

const reportBlog = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { reason } = req.body
    const updatedBlog = await blogService.reportBlog(id, userId, reason)
    res.status(StatusCodes.OK).json({ success: true, data: updatedBlog })
  } catch (error) {
    next(error)
  }
}

const searchBlogs = async (req, res, next) => {
  try {
    if (req.query.query) {
      const keyword = req.query.query.toString().trim();
      if (keyword) {
        SearchLogModel.create({ keyword }).catch(err => console.error('Failed to log search keyword:', err));
      }
    }

    const { blogs, pagination } = await blogService.searchBlogs(req.query, req.user)
    res.status(StatusCodes.OK).json({
      success: true,
      count: blogs.length,
      pagination,
      data: blogs
    })
  } catch (error) {
    next(error)
  }
}

export const blogController = {
  getBlogs,
  getPopularBlogs,
  getBlogById,
  getBlogBySlug, 
  createBlog,
  updateBlogPrivacy,
  updateBlogStatus,
  deleteBlog,
  likeBlog,
  updateBlog,
  getBlogsByAuthor,
  shareBlog,
  getBlogsByPlaceIdentifier,
  getBlogsByWard,
  reportBlog,
  searchBlogs,
  getBlogByIdPending
}
