const Vinyl = require('vinyl');
const gulp = require('gulp');
const path = require('path');
const sourcemaps = require('gulp-sourcemaps');
const through = require('through2');
const ts = require('gulp-typescript');
const {spawn} = require('child_process');

process.env.PATH =
    path.join(__dirname, 'node_modules', '.bin')
        + path.delimiter + process.env.PATH;

// TODO - gulp tasks to transform foo.proto to fooproto.js
//     node_modules/protobufjs/bin/pbjs -t static-module -w commonjs \
//         -o fooproto.js foo.proto
// and from there to fooproto.d.ts
//     node_modules/protobufjs/bin/pbts -o fooproto.d.ts fooproto.js

gulp.task('copy', () => gulp
          .src('src/**/*.ts')
          .pipe(gulp.dest('build/')));
gulp.task('pb', () => gulp
          .src('src/**/*.proto')
          .pipe(pbjs())
          .pipe(gulp.dest('build/'))
          .pipe(pbts())
          .pipe(gulp.dest('build/')));
gulp.task('ts', ['copy', 'pb'], () => gulp
          .src(['build/**/*.ts', '!build/**/*.d.ts'])
          .pipe(sourcemaps.init())
          .pipe(ts({
            noImplicitAny: true,
            noImplicitThis: true,
            strictNullChecks: true,
            //experimentalDecorators: true,
            //emitDecoratorMetadata: true,
            //lib: ['ES2015'],
            target: 'ES2015',
            module: 'commonjs',
          }))
          .pipe(sourcemaps.write())
          .pipe(gulp.dest('build/')));
gulp.task('default', ['ts'], () => gulp
          .src('build/**/*.js')
          .pipe(gulp.dest('out/')));

gulp.task('install-cron', () => gulp
          .src('data/autostart')
          .pipe(crontab()));
  //.pipe(spawnedProcess('sudo', ['crontab'], x => x + '.out')));

gulp.task('install', ['install-cron']);
          

function pbjs() {
  return spawnedProcess(
      'pbjs', ['-t', 'static-module', '-w', 'commonjs', '-'],
      path => path.replace(/\.proto$/, '.pb.js'));
}

function pbts() {
  return spawnedProcess(
      'pbts', ['-'], path => path.replace(/\.pb\.js$/, '.pb.d.ts'));
}

function crontab() {
  return through.obj((file, end, cb) => {
    const job = spawn('sudo', ['crontab']);
    job.stdin.end(`@reboot ${file.path}\n`);
    return cb();
  });
}

function spawnedProcess(command, args, pathTransform) {
  return through.obj((file, end, cb) => {
    if (file.isNull()) return cb(null, file);
    const job = spawn(command, args);
    if (file.isBuffer()) {
      job.stdin.end(file.contents);
    } else if (file.isStream()) {
      file.contents.pipe(job.stdin);
    } else {
      return cb(new Error('Unknown type ' + file), null);
    }
    return cb(null, new Vinyl({
      path: pathTransform(file.path),
      base: file.base,
      contents: job.stdout,
    }));
  });
}
