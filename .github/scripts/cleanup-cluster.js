module.exports = async ({ github, context, core, exec }) => {
  console.log('Cleaning up resources...');

  if (process.env.DEPLOY_NAMESPACE === 'test') {
    await exec.exec('kubectl', [
      'delete',
      'deployment',
      'lingua-quiz-backend',
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
  } else if (process.env.DEPLOY_NAMESPACE === 'default') {
    await exec.exec('kubectl', [
      'delete',
      'deployment',
      'lingua-quiz-backend',
      '-n',
      'default',
      '--ignore-not-found',
    ]);
  } else {
    console.log('The DEPLOY_NAMESPACE is not valid.');
  }

  console.log('Cleanup completed.');
};
