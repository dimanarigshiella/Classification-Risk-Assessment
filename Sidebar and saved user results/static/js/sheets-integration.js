// Google Sheets integration helper functions
function validateGoogleSheetsResponse(response) {
    if (!response.ok) {
        throw new Error('Failed to save to Google Sheets');
    }
    return response.json();
}

function handleGoogleSheetsError(error) {
    console.error('Google Sheets Error:', error);
    showError('Failed to save data. Please try again.');
} 