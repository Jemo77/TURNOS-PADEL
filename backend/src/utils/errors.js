class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflicto de datos') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

module.exports = { AppError, ConflictError };
