const { body } = require('express-validator');

const frame = [
  body('image')
    .isString()
    .withMessage('image is required and must be a base64 string.')
    .isLength({ min: 100, max: 8_000_000 })
    .withMessage('image payload is invalid.'),
];

const browser = [
  body('status')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 60 })
    .withMessage('status is too long.'),
  body('eventName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 60 })
    .withMessage('eventName is too long.'),
  body('detail')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 300 })
    .withMessage('detail is too long.'),
];

module.exports = { frame, browser };
