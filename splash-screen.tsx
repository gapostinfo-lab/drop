import { motion } from "framer-motion"

export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0f172a] text-white">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative mb-8"
      >
        <div className="relative h-32 w-32">
          {/* Logo Background */}
          <div className="absolute inset-0 rounded-3xl bg-[#0f172a] border-4 border-[#39FF14]/20 shadow-[0_0_50px_rgba(57,255,20,0.15)]" />
          
          {/* Logo SVG */}
          <svg viewBox="0 0 512 512" className="absolute inset-0 p-6 h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M128 192L256 128L384 192V320L256 384L128 320V192Z" stroke="#39FF14" strokeWidth="24" strokeLinejoin="round"/>
            <path d="M128 192L256 256L384 192" stroke="#39FF14" strokeWidth="24" strokeLinejoin="round"/>
            <path d="M256 256V384" stroke="#39FF14" strokeWidth="24" strokeLinejoin="round"/>
            <path d="M256 80V160M256 160L224 128M256 160L288 128" stroke="#39FF14" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          
          {/* Pulsing Ring */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.1, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -inset-4 rounded-[40px] border-2 border-[#39FF14]"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="flex flex-col items-center gap-2"
      >
        <h1 className="text-3xl font-bold tracking-tighter text-[#39FF14]">
          Droppit
        </h1>
        <div className="flex items-center gap-2">
          <motion.div
            animate={{
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="text-sm font-medium tracking-widest text-[#39FF14]/60 uppercase"
          >
            Loading
          </motion.div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
                className="h-1 w-1 rounded-full bg-[#39FF14]"
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
