import Blog from '../models/Blog.model.js'
import Place from '../models/Place.model.js'
import Category from '../models/Category.model.js'
import slugify from 'slugify'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError.js'
import UserModel from '~/models/User.model.js'
import { badgeActionService } from './badgeAction.service.js'
import mongoose from 'mongoose'

// Helper function to transform categories array to a comma-separated string of names
const transformCategoriesToString = (blog) => {
  if (blog && blog.categories && Array.isArray(blog.categories) && blog.categories.length > 0) {
    // Assuming categories are populated and have a 'name' property
    blog.categories = blog.categories.map(cat => cat.name).join(', ');
  }
  return blog;
};

// Helper function to determine media type
const getMediaType = (url) => {
  if (!url) return null
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
  const ext = url.substring(url.lastIndexOf('.')).toLowerCase()

  if (imageExtensions.includes(ext)) {
    return 'image'
  } else if (videoExtensions.includes(ext)) {
    return 'video'
  }
  return null // Unknown type
}

// Helper function to process album data
const processAlbumData = (album) => {
  if (!album || !Array.isArray(album)) {
    return []
  }
  return album.map(item => {
    // Ensure item is an object
    if (typeof item !== 'object' || item === null) {
      // If it's a string, try to infer type and create an object
      if (typeof item === 'string') {
        const type = getMediaType(item)
        if (type) {
          return { type, url: item, caption: null }
        }
      }
      return null // Invalid item, will be filtered out
    }

    // If item is already an object
    let url = item.url || null;
    let type = item.type || null;
    let caption = item.caption || null;

    // If URL is present but type is missing, try to infer type
    if (url && !type) {
      type = getMediaType(url);
    }

    // Ensure type is valid or set to null if unknown
    if (type && !['image', 'video'].includes(type)) {
      type = null;
    }

    // Only return if both url and type are present
    if (url && type) {
      return { url, type, caption };
    }
    return null; // Invalid item, will be filtered out
  }).filter(Boolean); // Remove null entries
}

// Lấy danh sách blogs
const getBlogs = async (query, user) => {
  const { search, tag, category, authorId, status, privacy, page = 1, limit = 10 } = query

  const filter = { destroy: false }

  if (search) {
    filter.title = { $regex: search, $options: 'i' };
  }
  if (tag) filter.tags = tag
  if (category) filter.categories = category
  if (authorId) filter.authorId = authorId
  if (privacy) filter.privacy = privacy

  if (user && user.role === 'admin') { // Only apply status filter if user is admin
    if (status) filter.status = status
  } else { // For non-admin users, force public and approved
    filter.privacy = 'public'
    filter.status = 'approved'
  }

  const skip = (page - 1) * limit
  const numericLimit = Number(limit)

  const totalBlogs = await Blog.countDocuments(filter)
  const blogs = await Blog.find(filter)
    .populate('authorId', '_id firstName lastName avatar')
    .populate('ward', '_id name')
    .populate('categories', '_id name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(numericLimit)
    .lean()

  // const transformedBlogs = blogs.map(transformCategoriesToString);

  return {
    // blogs: transformedBlogs,
    blogs,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(totalBlogs / numericLimit),
      totalBlogs
    }
  }

}

const searchBlogs = async (query, user) => {
  const { query: searchTerm, category, author, status, privacy, page = 1, limit = 10, sort, order } = query

  const filter = { destroy: false }

  if (searchTerm) {
    filter.$or = [
      { title: { $regex: searchTerm, $options: 'i' } },
      { tags: { $regex: searchTerm, $options: 'i' } }
    ]
  }
  if (category) filter.categories = category
  if (author) filter.authorId = author
  if (privacy) filter.privacy = privacy

  if (user && user.role === 'admin') {
    if (status) filter.status = status
  } else {
    filter.privacy = 'public'
    filter.status = 'approved'
  }

  const skip = (page - 1) * limit
  const numericLimit = Number(limit)

  const sortMapping = {
    newest: 'createdAt',
    popular: 'views',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    title: 'title',
    views: 'views'
  }

  const sortCriteria = {}
  const sortKey = sortMapping[sort] || 'createdAt'
  sortCriteria[sortKey] = order === 'asc' ? 1 : -1

  const totalBlogs = await Blog.countDocuments(filter)
  const blogs = await Blog.find(filter)
    .populate('authorId', '_id firstName lastName avatar')
    .populate('ward', '_id name')
    .populate('categories', '_id name')
    .sort(sortCriteria)
    .skip(skip)
    .limit(numericLimit)
    .lean()

  const transformedBlogs = blogs.map(transformCategoriesToString);

  return {
    blogs: transformedBlogs,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(totalBlogs / numericLimit),
      totalBlogs
    }
  }
}

// Lấy danh sách blogs có lượt xem nhiều
const getPopularBlogs = async (query, user) => {
  const { page = 1, limit = 10 } = query;

  const filter = { destroy: false };

  if (!user || user.role !== 'admin') {
    filter.privacy = 'public';
    filter.status = 'approved';
  }

  const skip = (page - 1) * limit;
  const numericLimit = Number(limit);

  const totalBlogs = await Blog.countDocuments(filter);
  const blogs = await Blog.find(filter)
    .populate('authorId', '_id firstName lastName avatar')
    .populate('ward', '_id name')
    .populate('categories', '_id name')
    .sort({ viewCount: -1 }) 
    .skip(skip)
    .limit(numericLimit)
    .lean();

  // const transformedBlogs = blogs.map(transformCategoriesToString);

  return {
    // blogs: transformedBlogs, 
    blogs,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(totalBlogs / numericLimit),
      totalBlogs
    }
  };
};

// Lấy chi tiết blog
const getBlogById = async (id, user) => {
  const blog = await Blog.findById(id)
    .populate('authorId', '_id firstName lastName avatar')
    .populate('categories', '_id name')
    .lean()

  if (!blog) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết')
  }

  // if (blog.destroy && user?.role !== 'admin') {
  //   throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết')
  // }

  if (blog.privacy === 'private' &&
    blog.authorId._id.toString() !== user?.id &&
    user?.role !== 'admin') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bạn không có quyền xem bài viết này')
  }

  if (blog.status === 'pending' && user?.role !== 'admin') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bài viết này chưa được duyệt')
  }

  Blog.updateOne({ _id: id }, { $inc: { viewCount: 1 } }).exec()
  return transformCategoriesToString(blog);
}
//
// Lấy chi tiết blog pending
const getBlogByIdPending = async (id, user) => {
  const blog = await Blog.findById(id)
    .populate('authorId', '_id firstName lastName avatar')
    .populate('categories', '_id name')
    .lean()

  if (!blog) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết')
  }

  // if (blog.destroy && user?.role !== 'admin') {
  //   throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết')
  // }

  if (blog.privacy === 'private' &&
    blog.authorId._id.toString() !== user?.id &&
    user?.role !== 'admin') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bạn không có quyền xem bài viết này')
  }

  // if (blog.status === 'approved' && user?.role !== 'admin') {
  //   throw new ApiError(StatusCodes.FORBIDDEN, 'Bài viết này chưa được duyệt')
  // }

  Blog.updateOne({ _id: id }, { $inc: { viewCount: 1 } }).exec()
  return transformCategoriesToString(blog);
}

// Lấy chi tiết blog theo slug
const getBlogBySlug = async (slug, user) => {
  const blog = await Blog.findOne({ slug })
    .populate('authorId', '_id firstName lastName avatar')
    .populate('categories', '_id name')
    .lean()

  if (!blog) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết')
  }
  if (blog.privacy === 'private' &&
    blog.authorId._id.toString() !== user?.id &&
    user?.role !== 'admin') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bạn không có quyền xem bài viết này')
  }

  if (blog.status === 'pending' && user?.role !== 'admin') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bài viết này chưa được duyệt')
  }

  Blog.updateOne({ _id: blog._id }, { $inc: { viewCount: 1 } }).exec()
  // return transformCategoriesToString(blog);
  return (blog);
}

// Tạo blog mới
const createBlog = async (blogData, authorId) => {
  const { title, content, album, categories, tags, privacy, locationDetail, ward, province } = blogData

  if (categories && categories.length > 0) {
    const validCategories = await Category.countDocuments({
      _id: { $in: categories },
      type: 'blog'
    });
    if (validCategories !== categories.length) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'One or more categories are invalid or not blog categories.');
    }
  }

  let baseSlug = slugify(title, { lower: true, strict: true, trim: true })
  let slug = baseSlug
  let count = 1
  while (await Blog.findOne({ slug })) {
    slug = `${baseSlug}-${count++}`
  }

  const processedAlbum = processAlbumData(album)

  const newBlog = await Blog.create({
    title,
    slug,
    mainImage: blogData.mainImage || (processedAlbum?.find(m => m.type === 'image')?.url ?? null),
    content,
    album: processedAlbum,
    categories: categories ? categories.map(id => new mongoose.Types.ObjectId(id)) : [],
    tags,
    privacy,
    authorId,
    locationDetail,
    ward,
    province: province || 'Hồ Chí Minh'
  })


  badgeActionService.handleUserAction(authorId, 'create_blog', { blogId: newBlog._id })
  return newBlog
}

// Cập nhật quyền riêng tư
const updateBlogPrivacy = async (blogId, newPrivacy, user) => {
  const blog = await Blog.findById(blogId)
  if (!blog) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết')

  if (blog.authorId.toString() !== user.id.toString() && user.role !== 'admin') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bạn không có quyền thực hiện hành động này')
  }

  blog.privacy = newPrivacy
  await blog.save()
  return blog
}

// Xóa blog
const deleteBlog = async (blogId, user) => {
  const blog = await Blog.findById(blogId)
  if (!blog) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết')

  if (blog.authorId.toString() !== user.id.toString() && user.role !== 'admin') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bạn không có quyền thực hiện hành động này')
  }

  if (user.role === 'admin') {
    blog.status = 'deleted'
    blog.deletedAt = new Date()
    await blog.save()

    setTimeout(async () => {
      const b = await Blog.findById(blogId)
      if (b && b.status === 'deleted') {
        await Blog.findByIdAndDelete(blogId)
        await UserModel.updateMany({}, { $pull: { sharedBlogs: { blog: blogId } } })
      }
    }, 3 * 24 * 60 * 60 * 1000)

    return { message: 'Bài viết đã bị đánh dấu xóa, sẽ tự động xóa sau 3 ngày' }
  } else {
    await Blog.findByIdAndDelete(blogId)
    await UserModel.updateMany({}, { $pull: { sharedBlogs: { blog: blog._id } } })
    return { message: 'Bài viết đã bị xoá khỏi hệ thống' }
  }
}

// Like / Unlike
const likeBlog = async (blogId, userId) => {
  const blog = await Blog.findById(blogId)
  if (!blog) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết.')

  const userIndex = blog.likeBy.findIndex(id => id.toString() === userId.toString())
  if (userIndex === -1) {
    blog.likeBy.push(userId)
    badgeActionService.handleUserAction(userId, 'like', { blogId })
  } else {
    blog.likeBy.splice(userIndex, 1)
  }
  blog.totalLikes = blog.likeBy.length
  await blog.save()
  return blog
}

// Share blog
const shareBlogById = async (blogId, userId) => {
  const originalBlog = await Blog.findById(blogId).populate('categories', 'name').lean();
  if (!originalBlog) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết gốc.')

  if (originalBlog.privacy !== 'public' || originalBlog.status !== 'approved') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bài viết này không thể chia sẻ.')
  }

  // Increment shareCount on the original blog
  await Blog.updateOne({ _id: blogId }, { $inc: { shareCount: 1 } });


  // Transform album to match schema
  const transformedAlbum = originalBlog.album.map(item => {
    if (typeof item === 'string') {
      const type = getMediaType(item)
      if (type) {
        return { type, url: item, caption: null }
      }
      return null // Invalid item, will be filtered out
    }
    // If it's already an object, ensure it has type and url
    if (item && item.type && item.url) {
      return item
    }
    return null // Invalid item, will be filtered out
  }).filter(Boolean) // Remove null entries

  // Create a new blog post for the share/repost
  let baseSlug = slugify(originalBlog.title, { lower: true, strict: true, trim: true })
  let newSlug = `${baseSlug}-${Date.now()}` // Ensure unique slug for the new post

  const newSharedBlog = await Blog.create({
    title: `Chia sẻ: ${originalBlog.title}`, // Add a prefix to indicate it's a share
    slug: newSlug,
    mainImage: originalBlog.mainImage,
    content: originalBlog.content,
    album: transformedAlbum,
    categories: originalBlog.categories.map(c => c._id), // Pass IDs to new blog
    tags: originalBlog.tags,
    privacy: 'public', // Default to public for shared posts
    totalLikes: 0, // New post starts with 0 likes
    shareCount: 0, // New post starts with 0 shares
    viewCount: 0, // New post starts with 0 views
    authorId: userId, // The user who is sharing is the author of the new post
    locationDetail: originalBlog.locationDetail,
    ward: originalBlog.ward,
    province: originalBlog.province,
    originalPostId: originalBlog._id, // Link to the original post
    status: 'pending', // New shared post might need approval
    destroy: false,
    deletedAt: null
  })

  // Update the user's sharedBlogs array (this part remains the same)
  await UserModel.findByIdAndUpdate(userId, {
    $push: { sharedBlogs: { blog: originalBlog._id, sharedAt: new Date() } }
  })

  badgeActionService.handleUserAction(userId, 'share', { blogId: newSharedBlog._id }) // Use the new blog's ID for badge action
  return newSharedBlog // Return the newly created shared blog
}

// Cập nhật trạng thái
const updateBlogStatus = async (blogId, newStatus, user) => {
  const blog = await Blog.findById(blogId)
  if (!blog) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết')
  if (user.role !== 'admin') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Chỉ admin mới có quyền chỉnh sửa trạng thái')
  }
  blog.status = newStatus
  await blog.save()
  return blog
}

// Cập nhật blog
const updateBlog = async (blogId, updateData, user) => {
  const blog = await Blog.findById(blogId)
  if (!blog) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết')

  if (updateData.categories) {
    const validCategories = await Category.countDocuments({
      _id: { $in: updateData.categories },
      type: 'blog'
    });
    if (validCategories !== updateData.categories.length) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'One or more categories are invalid or not blog categories.');
    }
  }

  if (blog.authorId.toString() !== user.id.toString() && user.role !== 'admin') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bạn không có quyền sửa bài viết này')
  }

  const allowedFields = ['title', 'content', 'album', 'mainImage', 'categories', 'tags', 'privacy', 'ward', 'district', 'province']
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      if (key === 'album') {
        blog[key] = processAlbumData(updateData[key])
      } else {
        blog[key] = updateData[key]
      }
    }
  })

  if (updateData.title) {
    let baseSlug = slugify(updateData.title, { lower: true, strict: true, trim: true })
    let slug = baseSlug
    let count = 1
    while (await Blog.findOne({ slug, _id: { $ne: blog._id } })) {
      slug = `${baseSlug}-${count++}`
    }
    blog.slug = slug
  }

  await blog.save()
  return blog
}

const getBlogsByAuthor = async (authorId, user) => {
  const filter = { authorId, destroy: false }

  if (user.role !== 'admin' && user.id.toString() !== authorId.toString()) {
    filter.privacy = 'public'
    filter.status = 'approved'
  }

  const blogs = await Blog.find(filter)
    .populate('authorId', '_id firstName lastName avatar')
    .populate('categories', '_id name')
    .sort({ createdAt: -1 })
    .lean()

  return blogs.map(transformCategoriesToString);
}

const getBlogsByPlaceIdentifier = async (identifier, query, user) => {
  const { page = 1, limit = 10, status } = query

  let place = null

  // Try to find place by ID
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    place = await Place.findById(identifier).populate('ward', 'name').lean()
  }

  // If not found by ID, try to find by slug
  if (!place) {
    place = await Place.findOne({ slug: identifier }).populate('ward', 'name').lean()
  }

  // If not found by slug, try to find by name (case-insensitive regex)
  if (!place) {
    place = await Place.findOne({ name: { $regex: identifier, $options: 'i' } }).populate('ward', 'name').lean()
  }

  const filter = { destroy: false }

  // If a place is found, search for blogs related to that place by name or ward.
  if (place) {
    const orConditions = []
    if (place.name) {
      // Tách các từ trong tên địa điểm
      const keywords = place.name.split(/\s+/).filter(Boolean)

      keywords.forEach((word) => {
        orConditions.push({ title: { $regex: word, $options: 'i' } })
        orConditions.push({ slug: { $regex: slugify(word, { lower: true, strict: true, trim: true }), $options: 'i' } })
      })
    }

    if (place.ward?._id) {
      orConditions.push({ ward: place.ward._id })
    }
    if (orConditions.length > 0) {
      filter.$or = orConditions
    }
  } else {
    // If no place is found, assume the identifier is a search term for blog titles or slugs.
    const searchTerm = slugify(identifier, { lower: true, strict: true, trim: true })
    filter.$or = [
      { title: { $regex: identifier, $options: 'i' } },
      { slug: { $regex: searchTerm, $options: 'i' } }
    ]
  }

  if (user && user.role === 'admin') { // Only apply status filter if user is admin
    if (status) filter.status = status
  } else { // For non-admin users, force public and approved
    filter.privacy = 'public'
    filter.status = 'approved'
  }

  const skip = (page - 1) * limit
  const numericLimit = Number(limit)

  const totalBlogs = await Blog.countDocuments(filter)
  const blogs = await Blog.find(filter)
    .select('title slug mainImage authorId ward createdAt totalLikes viewCount shareCount privacy status tags categories')
    .populate('authorId', '_id firstName lastName avatar')
    .populate('ward', '_id name')
    .populate('categories', '_id name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(numericLimit)
    .lean()

  const transformedBlogs = blogs.map(transformCategoriesToString);

  return {
    blogs: transformedBlogs,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(totalBlogs / numericLimit),
      totalBlogs
    }
  }
}

const getBlogsByWard = async (wardId, query, user) => {
  const { page = 1, limit = 10, status } = query

  const filter = { destroy: false, ward: wardId }

  if (user && user.role === 'admin') { // Only apply status filter if user is admin
    if (status) filter.status = status
  } else { // For non-admin users, force public and approved
    filter.privacy = 'public'
    filter.status = 'approved'
  }

  const skip = (page - 1) * limit
  const numericLimit = Number(limit)

  const totalBlogs = await Blog.countDocuments(filter)
  const blogs = await Blog.find(filter)
    .populate('authorId', '_id firstName lastName avatar')
    .populate('ward', '_id name')
    .populate('categories', '_id name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(numericLimit)
    .lean()

  const transformedBlogs = blogs.map(transformCategoriesToString);

  return {
    blogs: transformedBlogs,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(totalBlogs / numericLimit),
      totalBlogs
    }
  }
}

const reportBlog = async (blogId, userId, reason) => {
  const blog = await Blog.findById(blogId)
  if (!blog) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bài viết.')
  }

  const alreadyReported = blog.reports.find((report) => report.userId.toString() === userId.toString())
  if (alreadyReported) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Bạn đã báo cáo bài viết này rồi.')
  }

  blog.reports.push({ userId, reason })
  await blog.save()

  return blog
}


const getHotBlogs = async (limit = 2) => {
  try {
    const hotBlogs = await Blog.find({ status: 'approved', privacy: 'public', destroy: false })
      .sort({ viewCount: -1 }) // Sort by viewCount in descending order
      .limit(limit)
      .select('title slug mainImage authorId createdAt viewCount totalLikes categories') // Select relevant fields
      .populate('authorId', '_id firstName lastName avatar')
      .populate('categories', '_id name')
      .lean();

    return hotBlogs.map(transformCategoriesToString);
  } catch (error) {
    throw error
  }
}

export const blogService = {
  getBlogs,
  getPopularBlogs,
  getBlogById,
  getBlogBySlug,
  createBlog,
  updateBlogPrivacy,
  getBlogsByAuthor,
  deleteBlog,
  likeBlog,
  updateBlogStatus,
  updateBlog,
  shareBlogById,
  getBlogsByPlaceIdentifier,
  getBlogsByWard,
  reportBlog,
  getHotBlogs,
  searchBlogs,
  getBlogByIdPending
}
