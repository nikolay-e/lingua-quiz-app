import DOMPurify from 'dompurify';

class ErrorHandler {
  constructor() {
    this.errorContainer = null;
  }

  init() {
    this.errorContainer = document.createElement('div');
    this.errorContainer.id = 'error-container';
    this.errorContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      max-width: 300px;
      z-index: 9999;
    `;
    document.body.appendChild(this.errorContainer);
  }

  showError(message, duration = 5000) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.innerHTML = `
      <div style="
        background-color: #f8d7da;
        color: #721c24;
        padding: 10px;
        margin-bottom: 10px;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        font-family: 'Roboto', Arial, sans-serif;
        font-size: 14px;
      ">
        <strong>Error:</strong> ${DOMPurify.sanitize(message)}
      </div>
    `;

    this.errorContainer.appendChild(errorElement);

    setTimeout(() => {
      errorElement.remove();
    }, duration);
  }

  handleApiError(error) {
    console.error('API Error:', error);
    let errorMessage = 'An unexpected error occurred. Please try again later.';

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      errorMessage = error.response.data.message || errorMessage;
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = 'No response received from the server. Please check your internet connection.';
    } else {
      // Something happened in setting up the request that triggered an Error
      errorMessage = error.message;
    }

    this.showError(errorMessage);
  }
}

// eslint-disable-next-line import/prefer-default-export
export const errorHandler = new ErrorHandler();
