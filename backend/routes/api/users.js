const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const User = require('../../models/User');
const auth = require('../../middleware/auth');

async function parsePdfBuffer(buffer) {
  // Supports both v2.x class-based and v1.x function-based pdf-parse
  if (typeof pdfParse === 'function') {
    const data = await pdfParse(buffer);
    return (data.text || '').trim();
  }
  if (pdfParse?.PDFParse) {
    const parser = new pdfParse.PDFParse({ data: buffer });
    const result = await parser.getText();
    return (result?.text || '').trim();
  }
  if (pdfParse?.default && typeof pdfParse.default === 'function') {
    const data = await pdfParse.default(buffer);
    return (data.text || '').trim();
  }
  throw new Error('Unsupported pdf-parse interface');
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// @route POST api/users
// @desc Register user
// @access Public
router.post(
  '/',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check(
      'password',
      'Please enter a password with 6 or more characters'
    ).isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
      let user = await User.findOne({ email });

      if (user) {
        return res
          .status(400)
          .json({ errors: [{ msg: 'User already exists' }] });
      }

      user = new User({
        name,
        email,
        password,
      });

      const salt = await bcrypt.genSalt(10);

      user.password = await bcrypt.hash(password, salt);

      await user.save();

      const payload = {
        user: {
          id: user.id,
        },
      };

      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: 360000 },
        (err, token) => {
          if (err) throw err;
          res.json({ token });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route PUT api/users/profile
// @desc Update user profile (name, profile picture)
// @access Private
router.put(
  '/profile',
  auth,
  [
    // Optional validation for name and profilePicture if provided
    check('name', 'Name is required').optional().not().isEmpty().trim(),
    // Basic check for profilePicture URL format (can be improved)
    check('profilePicture', 'Please enter a valid URL for profile picture').optional().isURL()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, profilePicture } = req.body;

    // Build update object
    const profileFields = {};
    if (name) profileFields.name = name;
    if (profilePicture) profileFields.profilePicture = profilePicture;

    try {
      let user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ msg: 'User not found' });
      }

      // Update user fields
      user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: profileFields },
        { new: true, runValidators: true } // Return updated document and run schema validators
      ).select('-password'); // Don't return password

      res.json(user);
    } catch (err) {
      console.error(err.message);
      // Handle validation errors specifically if needed, otherwise send a generic 500
      if (err.kind === 'ObjectId') {
          return res.status(404).json({ msg: 'User not found' });
      }
       // Check for Mongoose validation errors
      if (err.name === 'ValidationError') {
          return res.status(400).json({ errors: Object.values(err.errors).map((e) => ({ msg: e.message })) });
      }
      res.status(500).send('Server error');
    }
  }
);

// @route POST api/users/resume/upload
// @desc Parse and save resume from PDF, Word (.docx), or text files
// @access Private
router.post('/resume/upload', [auth, upload.single('resumeFile')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No resume file uploaded' });
    }

    const { originalname, mimetype, buffer } = req.file;
    const lowerName = originalname.toLowerCase();
    let extractedText = '';

    if (lowerName.endsWith('.pdf') || mimetype === 'application/pdf') {
      extractedText = await parsePdfBuffer(buffer);
    } else if (
      lowerName.endsWith('.docx') ||
      lowerName.endsWith('.doc') ||
      mimetype.includes('wordprocessingml') ||
      mimetype.includes('msword')
    ) {
      const docxData = await mammoth.extractRawText({ buffer });
      extractedText = (docxData.value || '').trim();
    } else if (
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md') ||
      mimetype.startsWith('text/')
    ) {
      extractedText = buffer.toString('utf-8').trim();
    } else {
      // Fallback: try utf-8 string
      extractedText = buffer.toString('utf-8').trim();
    }

    if (!extractedText || extractedText.length < 20) {
      return res.status(400).json({
        msg: 'Could not extract substantive text from the uploaded document. Please check the file formatting or paste the text directly.',
      });
    }

    // Persist to user profile
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          resumeText: extractedText,
          resumeFileName: originalname,
          resumeUpdatedAt: new Date(),
        },
      },
      { new: true }
    ).select('-password');

    res.json({
      msg: 'Resume uploaded and parsed successfully',
      resumeText: user.resumeText,
      resumeFileName: user.resumeFileName,
      resumeUpdatedAt: user.resumeUpdatedAt,
    });
  } catch (err) {
    console.error('Error parsing uploaded resume:', err);
    res.status(500).json({ msg: 'Failed to parse resume document', error: err.message });
  }
});

// @route POST api/users/resume
// @desc Save user resume text and metadata
// @access Private
router.post(
  '/resume',
  auth,
  [
    check('resumeText', 'Resume text is required').not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { resumeText, fileName } = req.body;

    try {
      const user = await User.findByIdAndUpdate(
        req.user.id,
        {
          $set: {
            resumeText: resumeText.trim(),
            resumeFileName: fileName || 'Uploaded Resume',
            resumeUpdatedAt: new Date(),
          },
        },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ msg: 'User not found' });
      }

      res.json({
        msg: 'Resume saved successfully',
        resumeText: user.resumeText,
        resumeFileName: user.resumeFileName,
        resumeUpdatedAt: user.resumeUpdatedAt,
      });
    } catch (err) {
      console.error('Error saving resume:', err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route GET api/users/resume
// @desc Get current user's saved resume
// @access Private
router.get('/resume', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('resumeText resumeFileName resumeUpdatedAt');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json({
      resumeText: user.resumeText || '',
      resumeFileName: user.resumeFileName || null,
      resumeUpdatedAt: user.resumeUpdatedAt || null,
    });
  } catch (err) {
    console.error('Error fetching resume:', err.message);
    res.status(500).send('Server error');
  }
});

// @route PUT api/users/settings
// @desc Update user settings (e.g. custom BYOK API keys)
// @access Private
router.put('/settings', auth, async (req, res) => {
  try {
    const { customGroqKey, customGeminiKey } = req.body;
    const update = {};
    if (customGroqKey !== undefined) update.customGroqKey = customGroqKey ? customGroqKey.trim() : null;
    if (customGeminiKey !== undefined) update.customGeminiKey = customGeminiKey ? customGeminiKey.trim() : null;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true }
    ).select('customGroqKey customGeminiKey name email');

    if (!user) return res.status(404).json({ msg: 'User not found' });

    res.json({
      msg: 'Settings saved',
      customGroqKey: user.customGroqKey,
      customGeminiKey: user.customGeminiKey,
    });
  } catch (err) {
    console.error('Error updating settings:', err.message);
    res.status(500).send('Server error');
  }
});

// @route GET api/users/settings
// @desc Get user settings
// @access Private
router.get('/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('customGroqKey customGeminiKey');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({
      customGroqKey: user.customGroqKey || '',
      customGeminiKey: user.customGeminiKey || '',
    });
  } catch (err) {
    console.error('Error getting settings:', err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router; 