const { body } = require('express-validator');

const register = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Name must be between 2 and 120 characters.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email address is required.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be at least 8 characters long.'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number is too long.'),
];

const login = [
  body('identifier').trim().notEmpty().withMessage('Email or username is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

module.exports = { register, login };
