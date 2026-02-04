import React, { useEffect, useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform
} from "framer-motion";
import {
  ExternalLink,
  Link as LinkIcon,
  Sparkles,
  Flame
} from "lucide-react";

/* =====================================================
   ENV CONFIG
===================================================== */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const PROFILE_HANDLE =
  import.meta.env.VITE_PROFILE_HANDLE || "@YOUR.NAME";

const PROFILE_BIO =
  import.meta.env.VITE_PROFILE_BIO ||
  "รวมลิ้งก์ที่จำเป็นทั้งหมดไว้ที่เดียว";

const BG_IMAGE_URL = import.meta.env.VITE_BG_IMAGE_URL || "";
const BG_IMAGE_OPACITY = Number(
  import.meta.env.VITE_BG_IMAGE_OPACITY ?? 0.12
);

const ORANGE_HUE = Number(import.meta.env.VITE_ORANGE_HUE ?? 28);
const GLOW_INTENSITY = Number(import.meta.env.VITE_GLOW_INTENSITY ?? 0.65);

const MOTION_INTENSITY = Number(
  import.meta.env.VITE_MOTION_INTENSITY ?? 1.35
);
const MOTION_SPEED = Number(import.meta.env.VITE_MOTION_SPEED ?? 1.15);

/* =====================================================
   HELPERS
===================================================== */
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/* shimmer effect */
const shimmer = {
  initial: { backgroundPosition: "0% 0%" },
  animate: {
    backgroundPosition: "140% 0%",
    transition: {
      duration: 2.2 / MOTION_SPEED,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

/* =====================================================
   APP
===================================================== */
export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ===== Apply CSS vars from ENV ===== */
  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty(
      "--bg-image",
      BG_IMAGE_URL ? `url("${BG_IMAGE_URL}")` : "none"
    );
    root.style.setProperty(
      "--bg-opacity",
      String(clamp(BG_IMAGE_OPACITY, 0, 1))
    );
    root.style.setProperty(
      "--orange-hue",
      String(clamp(ORANGE_HUE, 0, 360))
    );
    root.style.setProperty(
      "--glow-intensity",
      String(clamp(GLOW_INTENSITY, 0, 1))
    );
  }, []);

  /* ===== Motion values (parallax / tilt) ===== */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const smx = useSpring(mx, { stiffness: 90, damping: 18 });
  const smy = useSpring(my, { stiffness: 90, damping: 18 });

  const glowX = useTransform(smx, (v) => `${v}px`);
  const glowY = useTransform(smy, (v) => `${v}px`);

  const tiltX = useTransform(smy, (v) => v * -0.25 * MOTION_INTENSITY);
  const tiltY = useTransform(smx, (v) => v * 0.25 * MOTION_INTENSITY);

  const onMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - (rect.left + rect.width / 2)) / 20);
    my.set((e.clientY - (rect.top + rect.height / 2)) / 20);
  };

  /* ===== Fetch topics ===== */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/public/topics`);
        const data = await res.json();
        setItems(data?.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const hasItems = useMemo(() => items.length > 0, [items]);

  const orange = `hsl(${ORANGE_HUE} 95% 58%)`;
  const orangeSoft = `hsl(${ORANGE_HUE} 95% 58% / 0.18)`;

  /* ===== Animation variants ===== */
  const listStagger = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.08 / MOTION_SPEED,
        delayChildren: 0.1 / MOTION_SPEED
      }
    }
  };

  const cardVariant = {
    hidden: { opacity: 0, y: 28, scale: 0.94 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 18
      }
    },
    exit: {
      opacity: 0,
      y: 18,
      scale: 0.96,
      transition: { duration: 0.18 }
    }
  };

  return (
    <div
      className="min-h-screen px-4 py-10 text-white"
      onMouseMove={onMouseMove}
    >
      {/* ===== Main glow ===== */}
      <motion.div
        style={{ translateX: glowX, translateY: glowY }}
        className="pointer-events-none fixed left-1/2 top-1/2 z-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${orangeSoft}, transparent 60%)`,
            opacity: clamp(GLOW_INTENSITY, 0, 1)
          }}
        />
      </motion.div>

      {/* ===== Floating orbs ===== */}
      <motion.div
        className="pointer-events-none fixed left-[12%] top-[18%] z-0 h-56 w-56 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${orangeSoft}, transparent 65%)` }}
        animate={{
          y: [0, -18 * MOTION_INTENSITY, 0],
          x: [0, 10 * MOTION_INTENSITY, 0]
        }}
        transition={{
          duration: 6 / MOTION_SPEED,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-xl">
        {/* ===== Header ===== */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          className="text-center"
        >
          <motion.div
            style={{ rotateX: tiltX, rotateY: tiltY }}
            className="mx-auto flex h-24 w-24 items-center justify-center rounded-full"
          >
            <motion.div
              className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-black/40 backdrop-blur-md"
              whileHover={{ scale: 1.06 }}
              animate={{
                boxShadow: [
                  "0 0 0 1px rgba(255,255,255,0.10), 0 12px 40px rgba(0,0,0,0.55)",
                  "0 0 0 1px rgba(255,255,255,0.14), 0 18px 52px rgba(0,0,0,0.62)",
                  "0 0 0 1px rgba(255,255,255,0.10), 0 12px 40px rgba(0,0,0,0.55)"
                ]
              }}
              transition={{
                duration: 3.2 / MOTION_SPEED,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Flame className="h-10 w-10" style={{ color: orange }} />
            </motion.div>
          </motion.div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-1 text-xs backdrop-blur">
            <Sparkles className="h-4 w-4" style={{ color: orange }} />
            Quick Links
          </div>

          <h1 className="mt-4 text-3xl font-bold">{PROFILE_HANDLE}</h1>
          <p className="mt-1 text-sm text-white/75">{PROFILE_BIO}</p>
        </motion.div>

        {/* ===== List ===== */}
        <motion.div
          className="mt-10 space-y-4"
          variants={listStagger}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                className="rounded-3xl bg-black/40 p-6 text-center backdrop-blur"
              >
                กำลังโหลดลิ้งก์...
              </motion.div>
            ) : hasItems ? (
              items.map((it) => (
                <motion.a
                  key={it.id}
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  variants={cardVariant}
                  whileHover={{
                    y: -6 * MOTION_INTENSITY,
                    rotateX: -2 * MOTION_INTENSITY,
                    rotateY: 2 * MOTION_INTENSITY,
                    scale: 1.02
                  }}
                  whileTap={{ scale: 0.98 }}
                  style={{ transformStyle: "preserve-3d" }}
                  className="group relative block overflow-hidden rounded-3xl border border-white/10 bg-black/45 backdrop-blur-md"
                >
                  {/* 🖼️ Image (show full, not too big) */}
                  {it.image_url && it.image_url !== "-" && (
                    <div className="relative w-full overflow-hidden rounded-t-3xl bg-black/40">
                      <div className="aspect-video max-h-[220px] w-full">
                        <img
                          src={it.image_url}
                          alt={it.title}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}


                  {/* shimmer */}
                  <motion.div
                    variants={shimmer}
                    initial="initial"
                    animate="animate"
                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
                    style={{
                      backgroundImage:
                        "linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.18) 45%, transparent 65%)",
                      backgroundSize: "220% 100%"
                    }}
                  />

                  {/* Content */}
                  <div className="relative p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <LinkIcon
                            className="h-5 w-5"
                            style={{ color: orange }}
                          />
                          <span className="truncate text-lg font-semibold">
                            {it.title}
                          </span>
                        </div>

                        {it.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-white/70">
                            {it.description}
                          </p>
                        )}
                      </div>

                      <motion.div
                        className="rounded-2xl border border-white/10 bg-black/40 p-2"
                        whileHover={{ rotate: 6, scale: 1.06 }}
                      >
                        <ExternalLink
                          className="h-5 w-5"
                          style={{ color: orange }}
                        />
                      </motion.div>
                    </div>

                    {/* bottom glow line */}
                    <motion.div
                      className="mt-4 h-[2px] w-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${orange}, transparent)`
                      }}
                      animate={{ opacity: [0.25, 0.45, 0.25] }}
                      transition={{
                        duration: 2.6 / MOTION_SPEED,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  </div>
                </motion.a>
              ))
            ) : (
              <motion.div
                key="empty"
                className="rounded-3xl bg-black/40 p-6 text-center backdrop-blur"
              >
                ยังไม่มีลิ้งก์ในระบบ
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ===== Footer ===== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 / MOTION_SPEED }}
          className="mt-10 text-center text-xs text-white/45"
        >
          Xerl - NJK.G9
        </motion.div>
      </div>
    </div>
  );
}
