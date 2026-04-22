# Legend Login (Vanish)

A playful and interactive login system with a "vanishing" button that disappears when input fields are empty, encouraging users to fill in their credentials.

## Features

- **Interactive Login Form**: Username and password fields with validation
- **Vanishing Button**: The login button disappears and reappears with animation if fields are empty
- **Sign Up Functionality**: Register new users with email, username, and password
- **Forget Password**: Reset password functionality with email verification
- **Responsive Design**: Modern glassmorphism UI with backdrop blur effects
- **Local Storage**: User data stored locally in the browser

## Demo

The login button will "vanish" if you try to hover over it without filling the username and password fields. Fill both fields to make it stay put!

## Technologies Used

- HTML5
- CSS3 (with backdrop-filter for glassmorphism)
- JavaScript (ES6+)
- Font Awesome for icons
- Unsplash for background image

## How to Use

1. Clone the repository
2. Open `index.html` in your browser
3. Fill in username and password to login
4. Click "Sign up" to create a new account
5. Use "Forget Password?" to reset your password

## Browser Support

- Chrome 76+
- Firefox 70+
- Safari 9+
- Edge 17+

(For backdrop-filter support)

## Development

This is a frontend-only application using localStorage for data persistence. In a production environment, you would want to integrate with a backend API for proper authentication and data storage.

## License

MIT License