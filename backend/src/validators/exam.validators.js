const { body, param } = require('express-validator');

const start = [
  body('examTitle')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Exam title is too long.'),
  body('deviceInfo')
    .optional({ values: 'falsy' })
    .isObject()
    .withMessage('deviceInfo must be an object.'),
];

const end = [
  body('finalRemarks')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Final remarks are too long.'),
];

const sessionIdParam = [
  param('id').isMongoId().withMessage('Invalid session identifier.'),
];

module.exports = { start, end, sessionIdParam };
