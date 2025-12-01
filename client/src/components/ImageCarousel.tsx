import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageCarouselProps {
  images: string[];
  alt: string;
}

export default function ImageCarousel({ images, alt }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-[4/3] bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-sm">No images</span>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        <img src={images[0]} alt={alt} className="w-full h-full object-cover" />
      </div>
    );
  }

  const handleGoToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToPrevious();
  };

  const handleGoToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToNext();
  };

  const goToSlide = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(index);
  };

  // Minimum swipe distance (in pixels) to trigger navigation
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }

    // Reset touch positions
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div 
      className="relative aspect-[4/3] overflow-hidden bg-muted group touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={images[currentIndex]}
        alt={`${alt} - Image ${currentIndex + 1}`}
        className="w-full h-full object-cover transition-opacity duration-300 select-none"
        draggable={false}
      />
      
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
        onClick={handleGoToPrevious}
        data-testid="button-carousel-prev"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
        onClick={handleGoToNext}
        data-testid="button-carousel-next"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={(e) => goToSlide(index, e)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex
                ? "bg-white scale-110"
                : "bg-white/50 hover:bg-white/75"
            }`}
            data-testid={`button-carousel-dot-${index}`}
          />
        ))}
      </div>

      <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}
