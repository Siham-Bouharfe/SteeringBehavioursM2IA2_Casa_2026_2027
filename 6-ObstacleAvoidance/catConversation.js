class CatConversation {
  constructor() { this.reset(); }

  reset() {
    for (const cat of this.participants || []) { cat.meowRemaining = 0; cat.chatPause = 0; cat.socialHeading = null; }
    this.participants = [];
    this.remaining = 0;
    this.replied = false;
    this.pendingReplies = [];
  }

  start(player, cats, audio) {
    // Every distinct E press calls out, even with nobody nearby.
    this.audio = audio;
    if (!this.participants.includes(player)) this.participants.push(player);
    player.meowRemaining = 0.9;
    this.remaining = Math.max(this.remaining, 0.9);
    audio?.play('meow', 1);
    const partner = cats.filter(cat => cat !== player && p5.Vector.dist(cat.pos, player.pos) < 125)
      .sort((a, b) => p5.Vector.dist(a.pos, player.pos) - p5.Vector.dist(b.pos, player.pos))[0];
    if (!partner) return null;
    if (!this.participants.includes(partner)) this.participants.push(partner);
    partner.chatPause = 1.5;
    partner.socialHeading = p5.Vector.sub(player.pos, partner.pos).heading();
    return partner;
  }

  // Called only after the invitation actually adds this cat to the followers.
  accept(partner) {
    if (!partner || this.pendingReplies.some(reply => reply.cat === partner)) return false;
    if (!this.participants.includes(partner)) this.participants.push(partner);
    const delay = Math.max(0.7, this.audio?.meowDuration || 0.7) + 0.1;
    this.pendingReplies.push({ cat: partner, remaining: delay, audio: this.audio });
    this.remaining = Math.max(this.remaining, delay + 0.9);
    this.replied = false;
    return true;
  }

  update(seconds) {
    for (const cat of this.participants) {
      cat.meowRemaining = Math.max(0, (cat.meowRemaining || 0) - seconds);
      cat.chatPause = Math.max(0, (cat.chatPause || 0) - seconds);
      if (!cat.chatPause) cat.socialHeading = null;
    }
    this.remaining = Math.max(0, this.remaining - seconds);
    for (const reply of this.pendingReplies) {
      reply.remaining -= seconds;
      if (reply.remaining <= 0) {
        this.replied = true;
        reply.cat.meowRemaining = 0.9;
        reply.audio?.play('meow', 2 + Math.round((reply.cat.idlePhase || 0) % 5));
      }
    }
    this.pendingReplies = this.pendingReplies.filter(reply => reply.remaining > 0);
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { CatConversation };
