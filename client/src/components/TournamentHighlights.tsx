export const TournamentHighlights = () => {
  return (
    <div className="mt-12 mb-8">
      <h2 className="text-2xl font-bold mb-6 text-neutral-dark">Tournament Highlights</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg overflow-hidden shadow-sm h-48">
          <img 
            src="https://images.unsplash.com/photo-1520871942340-48dd3bdc3bbe?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" 
            alt="Cornhole tournament" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="rounded-lg overflow-hidden shadow-sm h-48">
          <img 
            src="https://images.unsplash.com/photo-1516939884455-1445c8652f83?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" 
            alt="Cornhole tournament" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="rounded-lg overflow-hidden shadow-sm h-48">
          <img 
            src="https://images.unsplash.com/photo-1551431009-a802eeec77b1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" 
            alt="Tournament bracket" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="rounded-lg overflow-hidden shadow-sm h-48">
          <img 
            src="https://images.unsplash.com/photo-1547638375-ebf04735d1a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" 
            alt="Tournament bracket" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  );
};
