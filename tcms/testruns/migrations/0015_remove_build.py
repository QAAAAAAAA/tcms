from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("testruns", "0014_remove_auto_setting_start_date"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="testrun",
            name="build",
        ),
        migrations.RemoveField(
            model_name="testexecution",
            name="build",
        ),
    ]
