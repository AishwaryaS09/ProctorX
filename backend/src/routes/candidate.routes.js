const express = require('express');

const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { body } = require('express-validator');
const controller = require('../controllers/candidate.controller');

const router = express.Router();

const updateProfileValidators = [
  body('name').optional({ values: 'falsy' }).trim().isLength({ min: 2, max: 120 }).withMessage('Name must be between 2 and 120 characters.'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 }).withMessage('Phone number is too long.'),
];

router.get('/profile', protect, controller.getProfile);
router.put('/profile', protect, updateProfileValidators, validate, controller.updateProfile);

module.exports = router;
