/**
 * WebSocket /ws/jobs/:jobId — live log streaming.
 * Mavjud loglar darhol yuboriladi, keyin live.
 */
export default async function jobsRoutes(fastify) {
  fastify.get('/ws/jobs/:jobId', { websocket: true }, (socket, req) => {
    const { jobId } = req.params;

    const send = (msg) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(msg));
      }
    };

    const unsubscribe = fastify.jobs.subscribe(jobId, send);
    if (!unsubscribe) {
      send({ type: 'error', message: 'Job topilmadi yoki tugagan' });
      socket.close();
      return;
    }

    socket.on('close', () => unsubscribe?.());
    socket.on('error', () => unsubscribe?.());
  });
}
