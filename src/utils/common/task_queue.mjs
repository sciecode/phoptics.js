export class TaskQueue {
  constructor(url, options = {}) {
    const factor = options.factor || .5;
    const max = options.max_workers || 4;
    const count = options.workers || Math.min(max, navigator.hardwareConcurrency * factor | 0);

    this.jobs_id = 0;
    this.terminated = false;

    this.jobs = new Map();
    this.idle = new Array(count);
    for (let i = 0; i < count; i++)
      this.idle[i] = new Worker(url);
  }

  enqueue(info) {
    this.jobs.set(this.jobs_id++, info);
    while (this.idle.length) this.#dispatch(this.idle.pop());
  }

  #dispatch(worker, extra) {
    for (const [key, job] of this.jobs) {
      worker.onmessage = (mes) => { this.#fulfill(key, mes); }
      if (job.dispatch(worker, job.data, extra)) return true;
    };
    this.idle.push(worker);
    return false;
  }

  #fulfill(id, mes) {
    const job = this.jobs.get(id);
    const { finished, extra } = job.fulfill(job.data, mes);
    if (finished) this.jobs.delete(id);

    if (!this.#dispatch(mes.target, extra) && this.terminated && !this.jobs.size) this.#terminate();
  }

  #terminate() { for (let worker of this.idle) worker.terminate(); }

  dispose() {
    if (this.jobs.size) this.terminated = true;
    else this.#terminate();
  }
}