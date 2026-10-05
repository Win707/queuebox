export function errorHandler(error, _request, response, _next) {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  if (status === 500) console.error("Unhandled request error:", error);
  response.status(status).json({
    error: status === 500 ? "Something went wrong. Please try again." : error.message,
  });
}
