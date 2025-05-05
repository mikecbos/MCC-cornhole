import { FaFacebookF, FaTwitter, FaInstagram, FaEnvelope, FaPhone, FaMapMarkerAlt } from "react-icons/fa";

export const Footer = () => {
  return (
    <footer className="bg-neutral-dark text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">About the Tournament</h3>
            <p className="text-gray-300 text-sm">
              Join us for the annual Summer Cornhole Championship! This event brings together cornhole enthusiasts of all skill levels for a day of fun competition.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <ul className="text-gray-300 text-sm space-y-2">
              <li className="flex items-center">
                <FaEnvelope className="mr-2" /> info@cornholetournament.com
              </li>
              <li className="flex items-center">
                <FaPhone className="mr-2" /> (555) 123-4567
              </li>
              <li className="flex items-center">
                <FaMapMarkerAlt className="mr-2" /> 123 Community Park Way
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Follow Us</h3>
            <div className="flex space-x-4">
              <a href="#" className="text-white hover:text-gray-300 transition">
                <FaFacebookF className="text-xl" />
              </a>
              <a href="#" className="text-white hover:text-gray-300 transition">
                <FaTwitter className="text-xl" />
              </a>
              <a href="#" className="text-white hover:text-gray-300 transition">
                <FaInstagram className="text-xl" />
              </a>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-700 text-center text-gray-400 text-sm">
          &copy; {new Date().getFullYear()} Cornhole Tournament. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
