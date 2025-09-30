const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

const validateEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Please provide a valid email address');

const validateVerificationCode = body('verificationCode')
  .isLength({ min: 6, max: 6 })
  .isNumeric()
  .withMessage('Verification code must be 6 digits');

const validateBoardName = body('name')
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage('Board name must be between 1 and 100 characters');

const validateBoardDescription = body('description')
  .optional()
  .trim()
  .isLength({ max: 500 })
  .withMessage('Board description must not exceed 500 characters');

const validateCardName = body('name')
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage('Card name must be between 1 and 100 characters');

const validateCardDescription = body('description')
  .optional()
  .trim()
  .isLength({ max: 1000 })
  .withMessage('Card description must not exceed 1000 characters');

const validateTaskTitle = body('title')
  .trim()
  .isLength({ min: 1, max: 200 })
  .withMessage('Task title must be between 1 and 200 characters');

const validateTaskTitleOptional = body('title')
  .optional()
  .trim()
  .isLength({ min: 1, max: 200 })
  .withMessage('Task title must be between 1 and 200 characters');

const validateTaskDescription = body('description')
  .optional()
  .trim()
  .isLength({ max: 1000 })
  .withMessage('Task description must not exceed 1000 characters');

const validateTaskStatus = body('status')
  .optional()
  .isIn(['todo', 'in-progress', 'done'])
  .withMessage('Task status must be one of: todo, in-progress, done');

const validateTaskPriority = body('priority')
  .optional({ values: 'null' })
  .custom((value, { req }) => {
    if (value === null || value === undefined || value === '') {
      return true;
    }
    const allowedPriorities = ['low', 'medium', 'high'];
    if (allowedPriorities.includes(value)) {
      return true;
    }
    
    throw new Error('Task priority must be one of: low, medium, high, or null');
  });

const validateId = (paramName) => param(paramName)
  .notEmpty()
  .withMessage(`${paramName} is required`);

const validateMemberId = body('memberId')
  .notEmpty()
  .withMessage('Member ID is required');

const validateGithubAttachment = [
  body('type')
    .isIn(['pull_request', 'commit', 'issue'])
    .withMessage('Type must be one of: pull_request, commit, issue'),
  body('number')
    .optional()
    .isNumeric()
    .withMessage('Number must be numeric'),
  body('sha')
    .optional()
    .isLength({ min: 7, max: 40 })
    .withMessage('SHA must be between 7 and 40 characters')
];

// Validation rule sets
const authValidation = {
  signup: [validateEmail, validateVerificationCode, handleValidationErrors],
  signin: [validateEmail, validateVerificationCode, handleValidationErrors],
  sendCode: [validateEmail, handleValidationErrors]
};

const boardValidation = {
  create: [validateBoardName, validateBoardDescription, handleValidationErrors],
  update: [validateBoardName, validateBoardDescription, handleValidationErrors],
  getById: [validateId('id'), handleValidationErrors]
};

const cardValidation = {
  create: [validateCardName, validateCardDescription, handleValidationErrors],
  update: [validateCardName, validateCardDescription, handleValidationErrors],
  getById: [validateId('boardId'), validateId('id'), handleValidationErrors],
  getByUser: [validateId('boardId'), validateId('user_id'), handleValidationErrors]
};

const taskValidation = {
  create: [validateTaskTitle, validateTaskDescription, validateTaskStatus, validateTaskPriority, handleValidationErrors],
  update: [validateTaskTitle, validateTaskDescription, validateTaskStatus, validateTaskPriority, handleValidationErrors],
  getById: [validateId('boardId'), validateId('id'), validateId('taskId'), handleValidationErrors],
  assign: [validateMemberId, handleValidationErrors],
  githubAttach: [...validateGithubAttachment, handleValidationErrors]
};

// Export individual validation functions
const validateSendVerificationCode = [validateEmail, handleValidationErrors];
const validateSignup = [validateEmail, validateVerificationCode, handleValidationErrors];
const validateSignin = [validateEmail, validateVerificationCode, handleValidationErrors];
const validateUpdateProfile = [handleValidationErrors];

const validateCreateBoard = [validateBoardName, validateBoardDescription, handleValidationErrors];
const validateUpdateBoard = [validateBoardName, validateBoardDescription, handleValidationErrors];
const validateInviteMember = [handleValidationErrors];
const validateRespondToInvitation = [handleValidationErrors];

const validateCreateCard = [validateCardName, validateCardDescription, handleValidationErrors];
const validateUpdateCard = [validateCardName, validateCardDescription, handleValidationErrors];
const validateAssignMembers = [handleValidationErrors];

const validateCreateTask = [validateTaskTitle, validateTaskDescription, validateTaskPriority, handleValidationErrors];
const validateUpdateTask = [validateTaskTitleOptional, validateTaskDescription, validateTaskStatus, validateTaskPriority, handleValidationErrors];
const validateAssignTask = [handleValidationErrors];
const validateAttachGithubItem = [handleValidationErrors];

module.exports = {
  handleValidationErrors,
  validateSendVerificationCode,
  validateSignup,
  validateSignin,
  validateUpdateProfile,
  validateCreateBoard,
  validateUpdateBoard,
  validateInviteMember,
  validateRespondToInvitation,
  validateCreateCard,
  validateUpdateCard,
  validateAssignMembers,
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
  validateAttachGithubItem,
  validateTaskPriority,
  authValidation,
  boardValidation,
  cardValidation,
  taskValidation
};