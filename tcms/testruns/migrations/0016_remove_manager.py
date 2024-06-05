from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("testruns", "0015_remove_build"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="testrun",
            name="manager",
        ),
    ]
