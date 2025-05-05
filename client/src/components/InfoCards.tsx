import { FaUsers, FaTrophy, FaCalendarAlt } from "react-icons/fa";

export const InfoCards = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <div className="text-primary mb-4">
          <FaUsers className="text-2xl" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Team Registration</h3>
        <p className="text-gray-600">
          Sign up with a teammate or get matched with another player. Create your team name or let our AI suggest one for you.
        </p>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <div className="text-primary mb-4">
          <FaTrophy className="text-2xl" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Tournament Bracket</h3>
        <p className="text-gray-600">
          Watch the bracket form in real-time as teams register. See your path to victory!
        </p>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <div className="text-primary mb-4">
          <FaCalendarAlt className="text-2xl" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Event Details</h3>
        <p className="text-gray-600">
          Saturday, August 12th at Community Park. Check-in starts at 9:00 AM, games begin at 10:00 AM.
        </p>
      </div>
    </div>
  );
};
