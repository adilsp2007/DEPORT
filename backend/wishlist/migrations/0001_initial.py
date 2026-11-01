import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('products', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Wishlist',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='in_wishlists', to='products.product')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='wishlist_items', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Wishlist Item',
                'verbose_name_plural': 'Wishlist Items',
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['user', 'product'], name='wishlist_wi_user_id_446bf3_idx')],
                'constraints': [models.UniqueConstraint(fields=('user', 'product'), name='unique_user_product_wishlist')],
            },
        ),
    ]
