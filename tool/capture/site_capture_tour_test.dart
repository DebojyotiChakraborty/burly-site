// Captures for the marketing site (burly-site): walks the app with the sample
// backup imported and asks the host for a *simulator* screenshot at every stop,
// so each capture carries the real status bar and Dynamic Island.
//
//   # 1. the host watcher (scratchpad script): takes `simctl io screenshot`
//   #    for every file dropped in $SHOT_DIR/req and removes the request
//   # 2. the tour, one theme per run (fresh install; onboarding is shot first):
//   FLUTTER_XCODE_ARCHS=arm64 FLUTTER_XCODE_ONLY_ACTIVE_ARCH=YES \
//   flutter test integration_test/site_capture_tour_test.dart -d <sim udid> \
//     --dart-define=SAMPLE_PATH=/abs/path/to/tool/samples/burly-sample-backup.json \
//     --dart-define=SHOT_DIR=/abs/path/to/shots/dark \
//     --dart-define=SITE_THEME=dark
//
// Never calls `pumpAndSettle` (glass springs keep the tree busy forever). Every
// stop is wrapped in `attempt` so one missing screen never loses the rest.
import 'dart:io';

import 'package:burly/app/app.dart';
import 'package:burly/app/strings.dart';
import 'package:burly/app/theme/app_icons.dart';
import 'package:burly/app/theme/theme.dart';
import 'package:burly/data/settings/settings_repository_impl.dart';
import 'package:burly/features/achievements/screens/achievement_celebration_screen.dart';
import 'package:burly/features/achievements/widgets/trophy_case.dart';
import 'package:burly/features/exercises/widgets/exercise_row.dart';
import 'package:burly/features/history/screens/calendar_screen.dart';
import 'package:burly/features/home/widgets/weekly_rings_card.dart';
import 'package:burly/features/profile/widgets/rank_card.dart';
import 'package:burly/features/ranks/screens/rank_entry_screen.dart';
import 'package:burly/features/ranks/screens/ranks_screen.dart';
import 'package:burly/features/routines/screens/routine_detail_screen.dart';
import 'package:burly/features/routines/widgets/routine_card.dart';
import 'package:burly/features/settings/services/data_file_service.dart';
import 'package:burly/features/settings/services/local_data_file_service.dart';
import 'package:burly/features/share/screens/workout_complete_screen.dart';
import 'package:burly/features/stats/screens/statistics_screen.dart';
import 'package:burly/features/workout/widgets/exercise_block.dart';
import 'package:burly/features/workout/widgets/set_row.dart';
import 'package:burly/shared/providers/providers.dart';
import 'package:burly/shared/services/rest_timer_cue_service.dart';
import 'package:burly/shared/widgets/badges/animated_badge.dart';
import 'package:burly/shared/widgets/glass_buttons.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart' show Override;
import 'package:shared_preferences/shared_preferences.dart';

import 'onboarding_support.dart';
import 'sample_backup_support.dart';

const String kSamplePath = String.fromEnvironment('SAMPLE_PATH');
const String kShotDir = String.fromEnvironment('SHOT_DIR');
const String kTheme = String.fromEnvironment('SITE_THEME', defaultValue: 'dark');

/// A comma list of step names to walk (`workout,finish`); all when empty.
/// Onboarding and the import always run.
const String kSteps = String.fromEnvironment('SITE_STEPS');

const String kRoutine = 'Upper A';
const String kBench = 'Bench Press (Barbell)';
const String kRow = 'Bent Over Row (Barbell)';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('site capture: every screen the landing page shows', (WidgetTester tester) async {
    final List<String> skipped = <String>[];

    /// Asks the host for a screenshot named [name] and waits until it is taken.
    Future<void> shot(String name, {int settleFrames = 10}) async {
      await settle(tester, settleFrames);
      debugPrint('SITE SHOT $name');
      if (kShotDir.isEmpty) return;
      final File request = File('$kShotDir/req/$name');
      await request.create(recursive: true);
      final DateTime end = DateTime.now().add(const Duration(seconds: 20));
      while (request.existsSync() && DateTime.now().isBefore(end)) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      if (request.existsSync()) debugPrint('SITE SHOT $name: the host never took it');
      await settle(tester, 2);
    }

    Future<void> attempt(String what, Future<void> Function() body) async {
      if (kSteps.isNotEmpty && !kSteps.split(',').contains(what)) return;
      debugPrint('SITE step: $what');
      try {
        await body();
      } catch (error, stackTrace) {
        debugPrint('SITE SKIPPED $what: $error\n$stackTrace');
        skipped.add(what);
      }
    }

    Future<void> popToShell() async {
      for (int i = 0; i < 6; i++) {
        Finder trigger = find.byTooltip(Strings.back);
        if (trigger.evaluate().isEmpty) trigger = find.byTooltip(Strings.close);
        if (trigger.evaluate().isEmpty) break;
        await tester.tap(trigger.hitTestable().first, warnIfMissed: false);
        await settle(tester, 8);
      }
    }

    Finder tab(String label) =>
        find.descendant(of: find.byType(GlassTabBar), matching: find.text(label)).first;

    Finder cta(String label) => find.widgetWithText(AccentGlassButton, label);

    Future<void> goTab(String label) async {
      await tapFinder(tester, tab(label));
      await tapFinder(tester, tab(label));
      await settle(tester, 8);
    }

    Finder blockOf(String name) =>
        find.ancestor(of: find.text(name), matching: find.byType(ExerciseBlock)).first;

    Finder setRowAt(String name, int index) =>
        find.descendant(of: blockOf(name), matching: find.byType(SetRow)).at(index);

    Finder fieldOf(Finder row, int index) =>
        find.descendant(of: row, matching: find.byType(TextField)).at(index);

    Finder tickOf(Finder row) =>
        find.descendant(of: row, matching: find.widgetWithIcon(IconButton, AppIcons.check));

    /// Completes set [index] of [name], typing values first if the routine
    /// left the row empty.
    Future<void> tick(String name, int index, String weight, String reps) async {
      final Finder row = setRowAt(name, index);
      await revealCentred(tester, row);
      if (tester.widget<IconButton>(tickOf(row).first).onPressed == null) {
        await tester.tap(fieldOf(row, 0), warnIfMissed: false);
        await settle(tester, 3);
        await tester.enterText(fieldOf(row, 0), weight);
        await settle(tester, 3);
        await tester.enterText(fieldOf(row, 1), reps);
        await settle(tester, 4);
      }
      await tester.tap(tickOf(row).first.hitTestable(), warnIfMissed: false);
      await settle(tester, 8);
    }

    // ── Boot: the wanted theme, scripted file picker, no rest-timer prompt ──
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(SettingsKeys.themeMode, kTheme);

    final ScriptedFiles files = ScriptedFiles();
    if (kSamplePath.isNotEmpty) {
      files.pick = ImportFile(
        name: 'burly-sample-backup.json',
        contents: await File(kSamplePath).readAsString(),
      );
    }

    await LiquidGlassWidgets.initialize(enablePerformanceMonitor: !Platform.isAndroid);
    await tester.pumpWidget(
      LiquidGlassWidgets.wrap(
        brightnessResolver: Theme.maybeBrightnessOf,
        theme: AppTheme.glass,
        child: ProviderScope(
          retry: noRetry,
          overrides: <Override>[
            dataFileServiceProvider.overrideWithValue(files),
            restTimerCueServiceProvider.overrideWithValue(const NoopRestTimerCueService()),
          ],
          child: const App(splash: false),
        ),
      ),
    );
    await settle(tester, 20);
    final ProviderContainer container = ProviderScope.containerOf(tester.element(find.byType(App)));

    // ── Onboarding (fresh install only) ───────────────────────────────────
    for (int i = 0; i < 80; i++) {
      if (exists(find.text(Strings.onboardingGetStarted)) || exists(find.text(Strings.tabWorkout))) {
        break;
      }
      await tester.pump(const Duration(milliseconds: 100));
    }
    if (exists(find.text(Strings.onboardingGetStarted))) {
      await attempt('onboarding', () async {
        await shot('onboarding', settleFrames: 15);
      });
    }
    await completeOnboardingIfShown(tester);
    await waitFor(tester, find.text(Strings.tabWorkout));
    await settle(tester, 10);

    // ── Sample data ────────────────────────────────────────────────────────
    final bool empty = (await liveCompletedWorkouts(container)).isEmpty;
    if (empty && kSamplePath.isNotEmpty) {
      await attempt('import', () async {
        await openDataSettings(tester);
        await tapText(tester, Strings.settingsImport);
        await waitFor(
          tester,
          find.textContaining('Imported'),
          timeout: const Duration(seconds: 120),
        );
        await letSnackBarGo(tester);
        await popToShell();
      });
    }
    debugPrint('SITE data: ${await dataCounts(container)}');

    // ── Home ───────────────────────────────────────────────────────────────
    await attempt('home', () async {
      await goTab(Strings.tabHome);
      await waitFor(tester, find.byType(WeeklyRingsCard));
      await shot('home', settleFrames: 20);
    });

    // ── Workout tab, routine detail, live workout ──────────────────────────
    await attempt('routines', () async {
      await goTab(Strings.tabWorkout);
      await waitFor(tester, find.byType(RoutineCard));
      await shot('routines', settleFrames: 15);
    });

    await attempt('workout', () async {
      await goTab(Strings.tabWorkout);
      final Finder card = find.ancestor(of: find.text(kRoutine), matching: find.byType(RoutineCard));
      await pressUntil(
        tester,
        find.descendant(of: card, matching: find.text(kRoutine)),
        find.byType(RoutineDetailScreen),
      );
      await shot('routine_detail', settleFrames: 12);
      final Finder start = find.descendant(
        of: find.byType(RoutineDetailScreen),
        matching: cta(Strings.routineStartAction),
      );
      await revealCentred(tester, start);
      await tester.tap(start.hitTestable().first);
      await settle(tester, 12);
      if (exists(find.text(Strings.activeWorkoutDiscardAndStart))) {
        await tapText(tester, Strings.activeWorkoutDiscardAndStart);
      }
      await waitFor(tester, find.text(Strings.activeWorkoutFinish));
      await waitFor(tester, find.text(kBench));
      await settle(tester, 12);
      await shot('workout_start', settleFrames: 6);

      await tick(kBench, 0, '60', '8');
      await tick(kBench, 1, '80', '6');
      await tick(kBench, 2, '85', '5');
      await scroll(tester, -2000);
      await settle(tester, 8);
      await shot('workout', settleFrames: 8);

      // The glass entry keyboard over the next set.
      await tester.tap(fieldOf(setRowAt(kBench, 3), 0), warnIfMissed: false);
      await settle(tester, 10);
      await shot('workout_keypad', settleFrames: 4);
      await tick(kBench, 3, '85', '5');
    });

    await attempt('finish', () async {
      final Finder finish = find.text(Strings.activeWorkoutFinish).hitTestable();
      await waitFor(tester, finish);
      await tester.tap(finish.first);
      await settle(tester, 10);
      if (exists(find.text(Strings.activeWorkoutFinishDiscardIncomplete))) {
        await tapText(tester, Strings.activeWorkoutFinishDiscardIncomplete);
      }
      await waitFor(tester, cta(Strings.finishWorkoutSave));
      await shot('finish', settleFrames: 12);
      final Finder save = cta(Strings.finishWorkoutSave);
      await revealCentred(tester, save);
      await tester.tap(save.hitTestable().first);
      await settle(tester, 10);
      if (exists(find.text(Strings.updateRoutineKeep))) {
        await tapText(tester, Strings.updateRoutineKeep);
      }
      await waitFor(tester, find.byType(WorkoutCompleteScreen), timeout: const Duration(seconds: 40));
      await settle(tester, 14);
      await shot('complete', settleFrames: 0);
      await tapFinder(tester, find.byKey(const Key('workoutComplete.done')));
      await settle(tester, 10);
      if (exists(find.byType(AchievementCelebrationScreen))) {
        await waitFor(
          tester,
          find
              .descendant(
                of: find.byType(AchievementCelebrationScreen),
                matching: find.byType(AnimatedBadge),
              )
              .hitTestable(),
        );
        await settle(tester, 16);
        await shot('achievement', settleFrames: 0);
        while (exists(find.text(Strings.achievementNext).hitTestable())) {
          await tapText(tester, Strings.achievementNext);
          await settle(tester, 10);
        }
        await tapText(tester, Strings.achievementContinue);
        await settle(tester, 10);
      }
      await popToShell();
    });

    // ── Profile and its destinations ───────────────────────────────────────
    await attempt('profile', () async {
      await goProfile(tester);
      await shot('profile', settleFrames: 15);
      // The trophy case sits right under the rank card in a lazy sliver list:
      // centre the card first so the case is built, then centre the case.
      await revealCentred(tester, find.byType(RankCard));
      for (int i = 0; i < 6 && !exists(find.byType(TrophyCase)); i++) {
        await tester.drag(find.byType(CustomScrollView).first, const Offset(0, -240));
        await settle(tester, 4);
      }
      await revealCentred(tester, find.byType(TrophyCase));
      await shot('trophies', settleFrames: 10);
    });

    await attempt('calendar', () async {
      await goProfile(tester);
      await tapAfterRevealing(tester, find.text(Strings.profileDashboardCalendar));
      await waitFor(tester, find.byType(CalendarScreen));
      await waitFor(tester, find.text(Strings.calendarModeMonth));
      await shot('calendar', settleFrames: 15);
      await popToShell();
    });

    await attempt('statistics', () async {
      await goProfile(tester);
      await tapAfterRevealing(tester, find.text(Strings.profileDashboardStatistics));
      await waitFor(tester, find.byType(StatisticsScreen));
      await shot('statistics', settleFrames: 20);
      await popToShell();
    });

    await attempt('exercise', () async {
      await goProfile(tester);
      await tapAfterRevealing(tester, find.text(Strings.profileDashboardExercises));
      await waitFor(tester, find.byType(ExerciseRow));
      await shot('library', settleFrames: 12);
      await tester.enterText(find.byType(TextField).first, kBench);
      await settle(tester, 10);
      await tapFinder(tester, find.widgetWithText(ExerciseRow, kBench));
      await waitFor(tester, find.text(Strings.exerciseTabSummary));
      await waitFor(tester, find.text(Strings.exerciseChartHeaviestWeight));
      await shot('exercise', settleFrames: 20);
      await popToShell();
    });

    await attempt('ranks', () async {
      await goProfile(tester);
      await revealCentred(tester, find.byType(RankCard));
      await tester.tap(
        find.descendant(of: find.byType(RankCard), matching: find.byType(InkWell)).first.hitTestable(),
        warnIfMissed: false,
      );
      await waitFor(tester, find.byType(RanksScreen));
      await shot('ranks_intro', settleFrames: 20);
      await tapText(tester, Strings.rankIntroGo);
      await waitFor(tester, find.byType(RankEntryScreen));
      await shot('rank_entry', settleFrames: 25);
      await popToShell();
    });

    await attempt('measures', () async {
      await goProfile(tester);
      await tapAfterRevealing(tester, find.text(Strings.profileDashboardMeasures));
      await shot('measures', settleFrames: 18);
      await popToShell();
    });

    debugPrint('SITE done; skipped: ${skipped.isEmpty ? 'none' : skipped.join(', ')}');
    expect(true, isTrue);
  });
}
