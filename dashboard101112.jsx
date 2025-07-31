import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Main App component for the airline management dashboard
function App() {
  // State for Firebase and Firestore instances
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // State to store the user's entered Discord ID
  const [discordId, setDiscordId] = useState('');
  // State to track if the user is authorized
  const [isAuthorized, setIsAuthorized] = useState(false);

  // States for the flight booking form
  const [passengerName, setPassengerName] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  // State for form submission status
  const [formStatus, setFormStatus] = useState('');

  // State for controlling the custom modal
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // State for real-time bookings from Firestore
  const [liveBookings, setLiveBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState(null);

  // Allowed Discord User IDs for dashboard access
  const allowedUserIds = [
    '841067718110347314',
    '1129726655569600602',
    '1392997382660165833'
  ];

  // --- Firebase Initialization and Authentication ---
  useEffect(() => {
    // Initialize Firebase app using global config
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    const app = initializeApp(firebaseConfig);
    const firestoreDb = getFirestore(app);
    const firebaseAuth = getAuth(app);

    setDb(firestoreDb);
    setAuth(firebaseAuth);

    // Sign in with custom token if available, otherwise anonymously
    const initialAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined') {
          await signInWithCustomToken(firebaseAuth, __initial_auth_token);
        } else {
          await signInAnonymously(firebaseAuth);
        }
      } catch (error) {
        console.error("Firebase authentication error:", error);
        // Handle authentication errors, e.g., show a message to the user
      }
    };

    initialAuth();

    // Listen for auth state changes to get the user ID
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
      setIsAuthReady(true); // Auth state is ready after initial check
    });

    // Cleanup function for auth listener
    return () => unsubscribeAuth();
  }, []); // Run only once on component mount

  // --- Fetch Real-time Bookings from Firestore ---
  useEffect(() => {
    if (db && userId && isAuthReady && isAuthorized) { // Only fetch if Firebase is ready and user is authorized
      setLoadingBookings(true);
      setBookingsError(null);

      // Construct the collection path for public data
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const bookingsCollectionRef = collection(db, `artifacts/${appId}/public/data/bookings`);

      // For this example, we'll just fetch all documents and sort by timestamp in JS.
      const q = query(bookingsCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const bookingsData = [];
        snapshot.forEach((doc) => {
          bookingsData.push({ id: doc.id, ...doc.data() });
        });
        // Sort bookings by timestamp in descending order (most recent first)
        bookingsData.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
        setLiveBookings(bookingsData);
        setLoadingBookings(false);
      }, (error) => {
        console.error("Error fetching live bookings:", error);
        setBookingsError("Failed to load real-time bookings.");
        setLoadingBookings(false);
      });

      // Cleanup function for snapshot listener
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, isAuthorized]); // Re-run when db, userId, auth readiness, or authorization changes

  // Function to handle Discord ID submission for authorization
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (allowedUserIds.includes(discordId)) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
      setModalMessage('Access Denied: Your Discord ID is not authorized.');
      setShowModal(true);
    }
  };

  // Function to handle flight booking form submission to Firestore
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setFormStatus('Submitting...');

    if (!db || !userId) {
      setFormStatus('Error: Database not ready. Please try again.');
      return;
    }

    try {
      // Construct the collection path for public data
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const bookingsCollectionRef = collection(db, `artifacts/${appId}/public/data/bookings`);

      await addDoc(bookingsCollectionRef, {
        passengerName,
        flightNumber,
        origin,
        destination,
        departureDate,
        status: 'Confirmed', // Default status for new bookings
        timestamp: serverTimestamp(), // Add a server timestamp for ordering
        submittedBy: userId, // Record which user submitted it
      });

      setFormStatus('Booking submitted successfully!');
      // Clear form fields on success
      setPassengerName('');
      setFlightNumber('');
      setOrigin('');
      setDestination('');
      setDepartureDate('');
    } catch (error) {
      console.error('Error submitting booking to Firestore:', error);
      setFormStatus(`Submission failed: ${error.message}`);
    }
  };

  // Custom Modal Component
  const Modal = ({ message, onClose }) => {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
          <p className="text-lg font-semibold text-gray-800 mb-4">{message}</p>
          <button
            onClick={onClose}
            className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-300 ease-in-out"
          >
            OK
          </button>
        </div>
      </div>
    );
  };

  // Render the authentication screen if not authorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Airline Dashboard Access</h1>
          <p className="text-gray-600 mb-6">Please enter your Discord User ID to access the dashboard.</p>
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input
              type="text"
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="Your Discord User ID"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-300 ease-in-out transform hover:scale-105 shadow-md"
            >
              Access Dashboard
            </button>
          </form>
        </div>
        {showModal && <Modal message={modalMessage} onClose={() => setShowModal(false)} />}
      </div>
    );
  }

  // Render the dashboard if authorized
  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 shadow-lg rounded-b-xl">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
          <h1 className="text-4xl font-extrabold mb-2 md:mb-0">Airline Management Dashboard</h1>
          <div className="text-lg">
            Welcome, Authorized User! (ID: {discordId})
            {userId && <span className="ml-4 text-sm text-blue-200">(App User ID: {userId})</span>}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Discord Server Widget */}
        <section className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-gray-200 flex flex-col items-center justify-center">
          <h2 className="text-2xl font-bold text-blue-700 mb-4 pb-2 border-b-2 border-blue-200 w-full text-center">Discord Server</h2>
          <iframe
            src="https://discord.com/widget?id=1360357839876395319&theme=dark"
            width="100%" // Make it responsive
            height="500"
            allowTransparency="true"
            frameBorder="0"
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            title="Discord Server Widget"
            className="rounded-lg"
          ></iframe>
          <p className="text-gray-600 text-sm mt-3">
            Note: This widget displays live Discord server info.
          </p>
        </section>

        {/* Airline Overview Card (Now only reflects live bookings) */}
        <div className="lg:col-span-2 grid grid-cols-1 gap-6">
          <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-blue-700 mb-4 pb-2 border-b-2 border-blue-200">Airline Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-yellow-50 rounded-lg shadow-inner col-span-full">
                <p className="text-4xl font-bold text-yellow-800">{liveBookings.length}</p>
                <p className="text-gray-600">Total Bookings (Live)</p>
              </div>
            </div>
          </section>

          {/* Recent Bookings Card (Live Data from Firestore) */}
          <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-blue-700 mb-4 pb-2 border-b-2 border-blue-200">Recent Bookings (Live Data)</h2>
            {loadingBookings ? (
              <p className="text-gray-600">Loading live bookings...</p>
            ) : bookingsError ? (
              <p className="text-red-500">Error: {bookingsError}</p>
            ) : liveBookings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-lg overflow-hidden">
                  <thead className="bg-blue-100 text-blue-800">
                    <tr>
                      <th className="py-3 px-4 text-left">Booking ID</th>
                      <th className="py-3 px-4 text-left">Passenger Name</th>
                      <th className="py-3 px-4 text-left">Flight #</th>
                      <th className="py-3 px-4 text-left">Origin</th>
                      <th className="py-3 px-4 text-left">Destination</th>
                      <th className="py-3 px-4 text-left">Departure Date</th>
                      <th className="py-3 px-4 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveBookings.map(booking => (
                      <tr key={booking.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">{booking.id}</td>
                        <td className="py-3 px-4">{booking.passengerName}</td>
                        <td className="py-3 px-4">{booking.flightNumber}</td>
                        <td className="py-3 px-4">{booking.origin}</td>
                        <td className="py-3 px-4">{booking.destination}</td>
                        <td className="py-3 px-4">{booking.departureDate}</td>
                        <td className={`py-3 px-4 font-semibold ${
                          booking.status === 'Confirmed' ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {booking.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600">No bookings found. Submit a new booking below!</p>
            )}
          </section>
        </div>

        {/* Flight Booking Form */}
        <section className="lg:col-span-3 bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h2 className="text-2xl font-bold text-blue-700 mb-4 pb-2 border-b-2 border-blue-200">Book a Flight</h2>
          <form onSubmit={handleBookingSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="passengerName" className="block text-gray-700 text-sm font-bold mb-2">
                Passenger Name:
              </label>
              <input
                type="text"
                id="passengerName"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label htmlFor="flightNumber" className="block text-gray-700 text-sm font-bold mb-2">
                Flight Number:
              </label>
              <input
                type="text"
                id="flightNumber"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label htmlFor="origin" className="block text-gray-700 text-sm font-bold mb-2">
                Origin:
              </label>
              <input
                type="text"
                id="origin"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label htmlFor="destination" className="block text-gray-700 text-sm font-bold mb-2">
                Destination:
              </label>
              <input
                type="text"
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="departureDate" className="block text-gray-700 text-sm font-bold mb-2">
                Departure Date:
              </label>
              <input
                type="date"
                id="departureDate"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div className="md:col-span-2 flex flex-col items-center">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105 shadow-md"
              >
                Submit Booking
              </button>
              {formStatus && (
                <p className={`mt-3 text-center text-sm font-semibold ${
                  formStatus.includes('successfully') ? 'text-green-700' : 'text-red-600'
                }`}>
                  {formStatus}
                </p>
              )}
            </div>
          </form>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white p-4 text-center mt-8 rounded-t-xl">
        <p>&copy; {new Date().getFullYear()} Airline Management Dashboard. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
