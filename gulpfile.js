const gulp = require('gulp');
const zip = require('gulp-zip');

gulp.task('zip', () =>
  gulp.src('build/**')
    .pipe(zip('offline-audio-messenger.zip'))
    .pipe(gulp.dest('.'))
);
