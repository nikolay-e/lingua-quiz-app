module.exports = async ({github, context, core, exec}) => {
  console.log("Cleaning up resources...");

  await exec.exec('kubectl', ['delete', 'deployment', 'lingua-quiz-backend', '-n', process.env.DEPLOY_NAMESPACE, '--ignore-not-found']);

  if (process.env.DEPLOY_NAMESPACE === 'test') {
    await exec.exec('kubectl', ['delete', 'deployment', 'postgres', '-n', 'test', '--ignore-not-found']);
    await exec.exec('kubectl', ['delete', 'service', 'postgres', '-n', 'test', '--ignore-not-found']);
    await exec.exec('kubectl', ['delete', 'secret', 'postgres-secret', '-n', 'test', '--ignore-not-found']);
    await exec.exec('kubectl', ['delete', 'secret', 'jwt-secret', '-n', 'test', '--ignore-not-found']);
    await exec.exec('kubectl', ['delete', 'secret', 'tls-secret', '-n', 'test', '--ignore-not-found']);
  }

  console.log("Cleanup completed.");
};
