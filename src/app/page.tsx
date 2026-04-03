import Image from "next/image";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-[#262626] text-white px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1">
            <Image src="/logo.png" alt="Surfing Logo" width={54} height={54} className="object-contain" priority />
          </div>
          <span className="font-sans font-black text-[18px] uppercase tracking-wide">Surfing</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="font-black text-[18px] hover:text-white transition-colors duration-200 uppercase">Home</a>
          <a href="#" className="font-black text-[18px] text-[#bbbbbb] hover:text-white transition-colors duration-200 uppercase">Locations</a>
          <a href="#" className="font-black text-[18px] text-[#bbbbbb] hover:text-white transition-colors duration-200 uppercase">Gear</a>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative w-full h-[80vh] flex items-center justify-center bg-[#111] overflow-hidden">
        {/* Placeholder dark photography background */}
        <div className="absolute inset-0 bg-black/50 z-10"></div>
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=2940&auto=format&fit=crop")' }}
        />
        
        <div className="relative z-20 text-center px-4 max-w-5xl">
          <h1 className="text-white text-[60px] font-light uppercase leading-[1.30] tracking-wide mb-6">
            RIDE THE PERFECT WAVE
          </h1>
          <p className="text-white text-[16px] font-normal mb-8 leading-[1.15] max-w-2xl mx-auto">
            Experience uncompromised thrill and precise balance on the water.
          </p>
          <button className="bg-transparent border-b border-white text-white font-bold text-[16px] leading-[2.88] px-8 hover:bg-[#1c69d4] hover:border-[#1c69d4] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0653b6]">
            DISCOVER MORE
          </button>
        </div>
      </header>

      {/* Content Section */}
      <section className="py-24 px-8 max-w-7xl mx-auto bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-[#262626] text-[32px] font-normal leading-[1.30] mb-6">
              Uncompromising Performance.
            </h2>
            <p className="text-[#262626] text-[16px] leading-[1.15] font-normal mb-6">
              Our culture communicates precision, power, and confidence in the ocean. Every movement is defined by sharp technique and deliberate execution.
            </p>
            <p className="text-[#757575] text-[16px] leading-[1.15] font-normal mb-8">
              Explore the intersection of human endurance and nature's force.
            </p>
            <button className="bg-[#1c69d4] text-white font-bold text-[16px] leading-[2.88] px-8 hover:bg-[#0653b6] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0653b6]">
              BOOK A SESSION
            </button>
          </div>
          <div className="relative w-full aspect-video bg-[#262626]">
             <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1518177579124-78bfa7f8deeb?q=80&w=2940&auto=format&fit=crop")' }}
            />
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-24 px-8 bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "POWER", desc: "Engineered for maximum wave-riding responsiveness." },
              { title: "PRECISION", desc: "A singular technique defined by sharp carves." },
              { title: "ENDURANCE", desc: "Forward-thinking fitness tailored for the ocean." },
            ].map((feature, i) => (
              <div key={i} className="bg-white p-8">
                <h3 className="text-[#262626] text-[18px] font-black uppercase mb-4">{feature.title}</h3>
                <p className="text-[#757575] text-[16px] leading-[1.15]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
