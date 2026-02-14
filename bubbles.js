const bubbleLayer = document.getElementById("bubble-layer");
function createBubble() {
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const size = Math.random() * (30-20) + 10
  const allowedChunks = [1, 4, 5, 8];
const chunkWidth = 100 / 10;
const chunkIndex =
  allowedChunks[Math.floor(Math.random() * allowedChunks.length)];
const left =
  chunkIndex * chunkWidth +
  Math.random() * chunkWidth;
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${left}%`;
  const duration = Math.random() * 15 + 10;
  bubble.style.animationDuration = `${duration}s`;
  bubbleLayer.appendChild(bubble);
  setTimeout(() => {
    bubble.remove();
  }, duration * 1000);
}
setInterval(createBubble, 450);
for (let i = 0; i < 12; i++) {
  setTimeout(createBubble, i * 400);
}