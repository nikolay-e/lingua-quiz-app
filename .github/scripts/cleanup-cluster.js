module.exports = async ({ github, context, core, exec }) => {
  console.log('Cleaning up resources...');

  if (process.env.DEPLOY_NAMESPACE === 'test') {
    await exec.exec('kubectl', [
      'delete',
      'deployment',
      'lingua-quiz',
      '-n',
      'test',
      '--ignore-not-found',
    ]);
    await exec.exec('kubectl', [
      'delete',
      'deployment',
      'postgres',
      '-n',
      'test',
      '--ignore-not-found',
    ]);
    await exec.exec('kubectl', [
      'delete',
      'service',
      'postgres',
      '-n',
      'test',
      '--ignore-not-found',
    ]);
    await exec.exec('kubectl', [
      'delete',
      'service',
      'lingua-quiz-service',
      '-n',
      'test',
      '--ignore-not-found',
    ]);
    await exec.exec('kubectl', [
      'delete',
      'secret',
      'postgres-secret',
      '-n',
      'test',
      '--ignore-not-found',
    ]);
    await exec.exec('kubectl', [
      'delete',
      'secret',
      'jwt-secret',
      '-n',
      'test',
      '--ignore-not-found',
    ]);
    await exec.exec('kubectl', [
      'delete',
      'secret',
      'tls-secret',
      '-n',
      'test',
      '--ignore-not-found',
    ]);
    await exec.exec('kubectl', [
      'delete',
      'ingress',
      'lingua-quiz-ingress',
      '-n',
      'test',
      '--ignore-not-found',
    ]);
  } else if (process.env.DEPLOY_NAMESPACE === 'default') {
    await exec.exec('kubectl', [
      'delete',
      'deployment',
      'lingua-quiz',
      '-n',
      'default',
      '--ignore-not-found',
    ]);
  } else {
    console.log('The DEPLOY_NAMESPACE is not valid.');
  }

  console.log('Cleanup completed.');
};
