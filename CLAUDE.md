# Boomulator Project Guidelines

## Development Environment
- This is a vanilla HTML/CSS/JavaScript project without a build system
- To serve the project locally, use: `python -m http.server` or any simple HTTP server

## Code Style
- HTML: Use 4-space indentation, semantic elements, and lowercase tags
- CSS: Use CSS variables for colors and measurements, follow BEM naming for classes
- JavaScript:
  - Use camelCase for variable and function names
  - Prefer const/let over var
  - Document functions with comments for complex operations
  - Use descriptive variable names

## Project Structure
- Keep UI components organized in the HTML structure
- JavaScript handles simulation logic and graph rendering
- CSS uses responsive design patterns with mobile breakpoints

## Error Handling
- Validate user inputs with appropriate bounds
- Use try/catch blocks for potential runtime errors
- Provide visual feedback for user actions

## Testing
- Test on multiple browsers and screen sizes
- Verify calculations with known population models
- Test edge cases with extreme parameter values

## Performance
- Optimize canvas operations for smooth rendering
- Use setTimeout for heavy calculations to prevent UI blocking