const express = require('express');
const multer = require('multer');
const { storage, cloudinary } = require('../cloudinaryConfig');
const upload = multer({ storage });
const router = express.Router();
const event_model = require('../models/event_schema.js');
const middleware = require("../middleware/AuthMiddleware")
const Account = require("../models/account_schema");
const mongoose = require("mongoose")
 
// GET all event for content creator
router.get('/all_events', async (req, res) => {
  try {

    data = await event_model.find();
    return res.status(200).json({ message: 'success', data });

  } catch (err) {
    return res.status(500).json({ message: 'Failed', err });
  }

});

// GET all event news for admin
router.get('/events', middleware.ensureAuthenticated, async (req, res) => {
  try {

    const user = await Account.findById(req.session.Userid)
    let data;

    if (user.role === 'Admin') {
      data = await event_model.find().populate("author");
    } else if (user.role === 'Content_creator') {
      data = await event_model.find({ author: user._id }).populate("author");
    }

    return res.status(200).json({ message: 'success', data });

  } catch (err) {
    return res.status(500).json({ message: 'Failed', err });
  }

});

// POST new event news
router.post('/upload_events', upload.single('imageUrl'), middleware.ensureAuthenticated, async (req, res) => {
  try {
    const { title, description } = req.body;
    const imageUrl = req.file?.path;
    const authorId = req.session.Userid

    if (!title || !imageUrl || !description) {
      return res.status(400).json({ message: 'No Event uploaded' });
    }

    const newEvent = new event_model({
      title,
      imageUrl,
      description,
      author: authorId
    });

    await newEvent.save();
    return res.status(201).json({ message: 'Successfully uploaded event' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to upload' });
  }
});

// GET event news by ID
router.get('/single_event/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "invalid event id" });
  }
  try {
    const data = await event_model.findById(id);
    if (!data) {
      return res.status(404).json({ message: "invalid event id" });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(400).json({ message: "Failed", err });
  }
});

// Helper to extract Cloudinary public ID from imageUrl
function getCloudinaryPublicId(fileUrl) {
  if (!fileUrl) return null;
  const urlParts = fileUrl.split('/');
  const publicIdWithExt = urlParts[urlParts.length - 1];
  const publicId = publicIdWithExt.split('.')[0];
  const folder = urlParts[urlParts.length - 2];
  return `${folder}/${publicId}`;
}

// PUT (update) event news by ID
router.put('/update_event/:id', upload.single('imageUrl'), middleware.ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { title, description, } = req.body;
  const imageUrl = req.file?.path;
  const authorId = req.session.Userid

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "invalid update id" });
  }

  try {
    const existingEvent = await event_model.findById(id);
    if (!existingEvent) {
      return res.status(404).json({ message: "invalid event id" });
    }
    // If a new image is uploaded, delete the old image from Cloudinary
    if (req.file && existingEvent.imageUrl) {
      const publicId = getCloudinaryPublicId(existingEvent.imageUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        } catch (err) {
          console.error('Failed to delete old file from Cloudinary:', err);
        }
      }
    }
    // If a new image is uploaded, update imageUrl; otherwise, keep the old one
    const updated_data = {
      title,
      imageUrl: imageUrl ? imageUrl : existingEvent.imageUrl,
      description,
      author: authorId
    };
    const data = await event_model.findByIdAndUpdate(id, updated_data, { new: true });
    if (!data) {
      return res.status(404).json({ message: "invalid event id" });
    }
    res.status(201).json({ message: "Successfully updated event/news", data });
  } catch (err) {
    return res.status(400).json({ message: "Failed", err });
  }
});

// DELETE event news by ID
router.delete('/delete_event/:id', middleware.ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "invalid event id" });
  }
  try {
    const data = await event_model.findByIdAndDelete(id);
    if (!data) {
      return res.status(404).json({ message: "invalid event id" });
    }
    // After successful deletion, delete the image from Cloudinary if it exists
    if (data.imageUrl) {
      const publicId = getCloudinaryPublicId(data.imageUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        } catch (err) {
          console.error('Failed to delete file from Cloudinary:', err);
        }
      }
    }
    return res.status(200).json({ message: "Successfully deleted event/news" });
  } catch (err) {
    return res.status(400).json({ message: "Failed", err });
  }
});

module.exports = router;
