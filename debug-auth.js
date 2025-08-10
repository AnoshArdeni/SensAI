// Debug script to test authentication detection
// Run this in the browser console on http://localhost:9002

console.log('=== DEBUGGING AUTHENTICATION ===');

// Check if Clerk is loaded
console.log('1. Checking window.Clerk:', !!window.Clerk);
if (window.Clerk) {
    console.log('   - Clerk loaded:', window.Clerk.loaded);
    console.log('   - Clerk user:', window.Clerk.user);
    if (window.Clerk.user) {
        console.log('   - User ID:', window.Clerk.user.id);
        console.log('   - Email:', window.Clerk.user.primaryEmailAddress?.emailAddress);
        console.log('   - First name:', window.Clerk.user.firstName);
        console.log('   - Last name:', window.Clerk.user.lastName);
        console.log('   - Full name:', window.Clerk.user.fullName);
    }
}

// Check localStorage
console.log('2. Checking localStorage:');
console.log('   - clerk-user:', localStorage.getItem('clerk-user'));
console.log('   - sensai-auth:', localStorage.getItem('sensai-auth'));

// Check sessionStorage
console.log('3. Checking sessionStorage:');
console.log('   - clerk-user:', sessionStorage.getItem('clerk-user'));

// Check if user is signed in
console.log('4. Manual auth check:');
if (window.Clerk && window.Clerk.user) {
    const userData = {
        id: window.Clerk.user.id,
        email: window.Clerk.user.primaryEmailAddress?.emailAddress,
        firstName: window.Clerk.user.firstName,
        lastName: window.Clerk.user.lastName,
        fullName: window.Clerk.user.fullName
    };
    
    console.log('   - Manual user data:', userData);
    
    // Store for extension to read
    localStorage.setItem('sensai-auth', JSON.stringify(userData));
    console.log('   - Stored in sensai-auth for extension');
} else {
    console.log('   - No user found');
}

console.log('=== END DEBUG ===');